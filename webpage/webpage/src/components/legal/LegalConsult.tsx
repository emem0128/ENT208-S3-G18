import { type ClipboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Bot, CheckCircle2, Eraser, ImagePlus, Loader2, SendHorizonal, Trash2, UserRound, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LEGAL_CONSULT_SYSTEM_PROMPT } from '@/lib/legalPrompts';
import { chatWithMiniMaxStream, hasMiniMaxApiKey, type MiniMaxMessage } from '@/lib/minimax';
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_MB,
  MAX_IMAGES_PER_MESSAGE,
  isImageFile,
  recognizeImage,
  validateImageFile,
} from '@/lib/ocr';
import { useTranslation } from 'react-i18next';

type ChatMessage = MiniMaxMessage & {
  id: string;
  displayContent?: string;
  images?: string[];
};

type PendingImage = {
  id: string;
  file: File;
  previewUrl: string;
  ocrText?: string;
  lineCount?: number;
  ocrStatus: 'pending' | 'recognizing' | 'done' | 'failed';
  errorMessage?: string;
};

const LegalConsult = () => {
  const { t } = useTranslation();
  const emptyTips = [
    t('legal.tips.liabilityCap'),
    t('legal.tips.subcontractRecourse'),
    t('legal.tips.cargoDamageEvidence'),
  ];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const pendingImagesRef = useRef<PendingImage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  useEffect(() => {
    return () => {
      pendingImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      messagesRef.current.forEach((message) => {
        message.images?.forEach((imageUrl) => URL.revokeObjectURL(imageUrl));
      });
    };
  }, []);

  const placeholder = useMemo(() => {
    if (!hasMiniMaxApiKey()) {
      return t('legal.consultPlaceholderNoKey');
    }

    return t('legal.consultPlaceholder');
  }, [t]);

  const getValidationMessage = useCallback((file: File) => {
    const validationError = validateImageFile(file);
    if (validationError === 'too_large') {
      return t('legal.imageTooLarge', { maxMB: MAX_IMAGE_SIZE_MB });
    }

    if (validationError === 'invalid_type') {
      return t('legal.invalidImageType');
    }

    return null;
  }, [t]);

  const handleAddImages = useCallback((files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(isImageFile);
    if (imageFiles.length === 0) {
      return;
    }

    const availableSlots = MAX_IMAGES_PER_MESSAGE - pendingImagesRef.current.length;
    if (availableSlots <= 0) {
      toast.error(t('legal.tooManyImages', { max: MAX_IMAGES_PER_MESSAGE }));
      return;
    }

    if (imageFiles.length > availableSlots) {
      toast.error(t('legal.tooManyImages', { max: MAX_IMAGES_PER_MESSAGE }));
    }

    const nextImages = imageFiles.slice(0, availableSlots).reduce<PendingImage[]>((validImages, file) => {
      const validationMessage = getValidationMessage(file);
      if (validationMessage) {
        toast.error(validationMessage);
        return validImages;
      }

      validImages.push({
        id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        ocrStatus: 'pending',
      });

      return validImages;
    }, []);

    if (nextImages.length === 0) {
      return;
    }

    setPendingImages((current) => [...current, ...nextImages]);

    nextImages.forEach((image) => {
      setPendingImages((current) =>
        current.map((item) => item.id === image.id ? { ...item, ocrStatus: 'recognizing' } : item)
      );

      void recognizeImage(image.file)
        .then((result) => {
          const ocrText = result.text.trim();
          if (!ocrText) {
            throw new Error(t('legal.ocrEmptyResult'));
          }

          setPendingImages((current) =>
            current.map((item) =>
              item.id === image.id
                ? { ...item, ocrStatus: 'done', ocrText, lineCount: result.lineCount }
                : item
            )
          );
        })
        .catch((ocrError) => {
          const message = ocrError instanceof Error ? ocrError.message : t('legal.consultFailed');
          setPendingImages((current) =>
            current.map((item) =>
              item.id === image.id
                ? { ...item, ocrStatus: 'failed', errorMessage: message }
                : item
            )
          );
          toast.error(t('legal.imageRecognitionFailed', { error: message }));
        });
    });
  }, [getValidationMessage, t]);

  const handleRemoveImage = useCallback((id: string) => {
    setPendingImages((current) => {
      const image = current.find((item) => item.id === id);
      if (image) {
        URL.revokeObjectURL(image.previewUrl);
      }

      return current.filter((item) => item.id !== id);
    });
  }, []);

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      event.preventDefault();
      handleAddImages(imageFiles);
    }
  };

  const handleSend = async () => {
    const question = input.trim();

    if (!question && pendingImages.length === 0) {
      return;
    }

    const stillRecognizing = pendingImages.some((image) => image.ocrStatus === 'pending' || image.ocrStatus === 'recognizing');
    if (stillRecognizing) {
      toast.info(t('legal.waitingForOcr'));
      return;
    }

    const successfulImages = pendingImages.filter((image) => image.ocrStatus === 'done' && image.ocrText);
    if (!question && pendingImages.length > 0 && successfulImages.length === 0) {
      toast.error(t('legal.ocrEmptyResult'));
      return;
    }

    let userContent = '';
    if (pendingImages.length > 0) {
      if (successfulImages.length > 0) {
        userContent += '【用户上传了以下图片，OCR 识别内容如下】\n\n';
        successfulImages.forEach((image, index) => {
          userContent += `--- 图片 ${index + 1}（${image.file.name}）---\n${image.ocrText}\n\n`;
        });
      }

      const failedCount = pendingImages.length - successfulImages.length;
      if (failedCount > 0) {
        userContent += `【其中 ${failedCount} 张图片识别失败，已跳过】\n\n`;
      }
    }

    if (question) {
      userContent += `${userContent ? '【用户问题】\n' : ''}${question}`;
    }

    const sentImageUrls = pendingImages.map((image) => image.previewUrl);
    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: userContent,
      displayContent: question || t('legal.uploadedImageQuestion'),
      images: sentImageUrls,
    };

    const nextMessages = [...messages, userMessage];
    const assistantMessageId = `${Date.now()}-assistant`;
    const streamingAssistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
    };

    setMessages([...nextMessages, streamingAssistantMessage]);
    setPendingImages([]);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const response = await chatWithMiniMaxStream([
        { role: 'system', content: LEGAL_CONSULT_SYSTEM_PROMPT },
        ...nextMessages.map(({ role, content }) => ({ role, content })),
      ], (chunk) => {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId
              ? { ...message, content: message.content + chunk }
              : message
          )
        );
      });

      const finalContent = response || t('legal.emptyConsultResult');
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? { ...message, content: finalContent }
            : message
        )
      );
    } catch (chatError) {
      const message = chatError instanceof Error ? chatError.message : t('legal.consultFailed');
      setMessages((current) => current.filter((item) => item.id !== assistantMessageId));
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    messages.forEach((message) => {
      message.images?.forEach((imageUrl) => URL.revokeObjectURL(imageUrl));
    });
    setMessages([]);
    setPendingImages([]);
    setError('');
    setInput('');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card
        className="relative overflow-hidden border-primary/10 shadow-sm"
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDragActive(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          const files = Array.from(event.dataTransfer.files).filter(isImageFile);
          if (files.length > 0) {
            handleAddImages(files);
          }
        }}
      >
        {dragActive ? (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm">
            <div className="rounded-lg border-2 border-dashed border-primary bg-background/90 px-12 py-8 text-sm font-medium text-primary shadow-sm">
              {t('legal.dropToUpload')}
            </div>
          </div>
        ) : null}
        <CardHeader className="border-b bg-muted/20">
          <CardTitle>{t('legal.legalConsult')}</CardTitle>
          <CardDescription>{t('legal.consultDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-6">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('legal.requestFailed')}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <ScrollArea className="h-[560px] rounded-lg border bg-background">
            <div className="flex flex-col gap-4 p-4">
              {messages.length === 0 ? (
                <div className="rounded-lg border border-dashed px-5 py-12 text-center text-sm text-muted-foreground">
                  {t('legal.noConsult')}
                </div>
              ) : (
                messages.map((message) => {
                  const isAssistant = message.role === 'assistant';

                  return (
                    <div key={message.id} className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`flex max-w-[85%] gap-3 rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm ${
                          isAssistant
                            ? 'border bg-card text-card-foreground'
                            : 'bg-primary text-primary-foreground'
                        }`}
                      >
                        <div className="pt-0.5">
                          {isAssistant ? <Bot className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 space-y-3">
                          {message.images?.length ? (
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {message.images.map((imageUrl, index) => (
                                <a key={imageUrl} href={imageUrl} target="_blank" rel="noreferrer" className="block">
                                  <img
                                    src={imageUrl}
                                    alt={t('legal.uploadedImageAlt', { index: index + 1 })}
                                    className="h-20 w-20 rounded-md object-cover"
                                  />
                                </a>
                              ))}
                            </div>
                          ) : null}
                          <div className="whitespace-pre-wrap">{message.displayContent || message.content}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

            </div>
          </ScrollArea>

          {pendingImages.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto rounded-lg border bg-muted/20 p-3">
              {pendingImages.map((image) => (
                <div key={image.id} className="relative w-24 shrink-0">
                  <img
                    src={image.previewUrl}
                    alt={image.file.name}
                    className="h-20 w-20 rounded-md border object-cover"
                  />
                  <button
                    type="button"
                    className="absolute -right-1 -top-2 rounded-full border bg-background p-1 text-muted-foreground shadow-sm transition hover:text-destructive"
                    onClick={() => handleRemoveImage(image.id)}
                    aria-label={t('legal.removeImage')}
                    title={t('legal.removeImage')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <div className="mt-1 flex items-center gap-1 text-[11px] leading-4 text-muted-foreground">
                    {image.ocrStatus === 'done' ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : null}
                    {image.ocrStatus === 'failed' ? <XCircle className="h-3 w-3 text-destructive" /> : null}
                    {image.ocrStatus === 'pending' || image.ocrStatus === 'recognizing' ? (
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    ) : null}
                    <span className="truncate">
                      {image.ocrStatus === 'done'
                        ? t('legal.imageRecognized', { lines: image.lineCount ?? 0 })
                        : image.ocrStatus === 'failed'
                          ? t('legal.imageRecognitionFailed', { error: image.errorMessage || t('legal.consultFailed') })
                          : t('legal.imageRecognizing')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex gap-3">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  if (!loading) {
                    void handleSend();
                  }
                }
              }}
              placeholder={placeholder}
              onPaste={handlePaste}
              disabled={loading || !hasMiniMaxApiKey()}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES}
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files) {
                  handleAddImages(event.target.files);
                }
                event.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || !hasMiniMaxApiKey()}
              title={t('legal.uploadImageHint')}
              aria-label={t('legal.uploadImage')}
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleSend}
              disabled={loading || (!input.trim() && pendingImages.length === 0) || !hasMiniMaxApiKey()}
              loading={loading}
            >
              <SendHorizonal className="h-4 w-4" />
              {t('legal.send')}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">{t('legal.pasteImageHint')}</div>
        </CardContent>
      </Card>

      <Card className="border-primary/10 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{t('legal.assistant')}</CardTitle>
              <CardDescription>{t('legal.assistantDescription')}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleClear} disabled={messages.length === 0 && !input && pendingImages.length === 0}>
              <Eraser className="h-4 w-4" />
              {t('legal.clearChat')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {emptyTips.map((tip) => (
            <button
              type="button"
              key={tip}
              className="rounded-lg border bg-background px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
              onClick={() => setInput(tip)}
            >
              {tip}
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default LegalConsult;
