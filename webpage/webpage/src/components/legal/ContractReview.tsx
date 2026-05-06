import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { AlertCircle, FileText, History, ShieldAlert, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { createLegalReview, getRecentLegalReviews } from '@/db/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { buildContractReviewUserPrompt, CONTRACT_REVIEW_SYSTEM_PROMPT } from '@/lib/legalPrompts';
import { parseLegalFile, type ParsedLegalFile } from '@/lib/fileParsers';
import { chatWithMiniMaxStream } from '@/lib/minimax';
import type { LegalReview } from '@/types/database';
import { useTranslation } from 'react-i18next';

function getRiskLevel(content: string): LegalReview['risk_level'] {
  const matched = content.match(/总体风险评级[：:\s]*([高中低])/);
  const level = matched?.[1];

  if (level === '高' || level === '中' || level === '低') {
    return level;
  }

  return null;
}

function getRiskBadgeVariant(level: string | null): 'destructive' | 'secondary' | 'outline' {
  if (level === '高') {
    return 'destructive';
  }

  if (level === '中') {
    return 'secondary';
  }

  return 'outline';
}

const ContractReview = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedFile, setParsedFile] = useState<ParsedLegalFile | null>(null);
  const [reviewResult, setReviewResult] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [historyItems, setHistoryItems] = useState<LegalReview[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<number | null>(null);

  const riskLevel = useMemo(() => getRiskLevel(reviewResult), [reviewResult]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError('');

    try {
      const reviews = await getRecentLegalReviews(10);
      setHistoryItems(reviews);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : t('legal.historyLoadFailed');
      setHistoryError(message);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const handleFileChange = async (file: File | null) => {
    setSelectedFile(file);
    setParsedFile(null);
    setReviewResult('');
    setError('');
    setActiveHistoryId(null);

    if (!file) {
      return;
    }

    try {
      const parsed = await parseLegalFile(file);
      setParsedFile(parsed);
      toast.success(t('legal.fileParsed'));
    } catch (fileError) {
      const message = fileError instanceof Error ? fileError.message : t('legal.fileParseFailed');
      setError(message);
      toast.error(message);
    }
  };

  const handleReview = async () => {
    if (!selectedFile) {
      const message = t('legal.uploadFirst');
      setError(message);
      toast.error(message);
      return;
    }

    setLoading(true);
    setError('');
    setReviewResult('');

    try {
      const parsed = parsedFile ?? (await parseLegalFile(selectedFile));
      setParsedFile(parsed);

      const response = await chatWithMiniMaxStream([
        { role: 'system', content: CONTRACT_REVIEW_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildContractReviewUserPrompt({
            fileName: parsed.fileName,
            fileTypeLabel: parsed.fileTypeLabel,
            originalLength: parsed.originalLength,
            truncatedLength: parsed.truncatedLength,
            text: parsed.text,
          }),
        },
      ], (chunk) => {
        setReviewResult((prev) => prev + chunk);
      });

      const finalResult = response || t('legal.emptyModelResult');
      const savedReview = await createLegalReview({
        file_name: parsed.fileName,
        review_result: finalResult,
        risk_level: getRiskLevel(finalResult),
        created_by: user?.username ?? null,
      });

      setReviewResult(finalResult);
      setActiveHistoryId(savedReview.id);
      await loadHistory();
      toast.success(t('legal.reviewSaved'));
    } catch (reviewError) {
      const message = reviewError instanceof Error ? reviewError.message : t('legal.reviewFailed');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-180px)] gap-6 overflow-hidden">
      <Card className="flex w-[260px] shrink-0 flex-col overflow-hidden border-primary/10 shadow-sm">
        <CardHeader className="border-b bg-gradient-to-b from-[#0f2a5e] to-[#1a3f8f] pb-4 text-white">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            {t('legal.history')}
          </CardTitle>
          <CardDescription className="text-white/70">{t('legal.recentReviews')}</CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto p-0">
          {historyLoading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t('legal.historyLoading')}</div>
          ) : historyError ? (
            <div className="px-4 py-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t('legal.historyLoadFailed')}</AlertTitle>
                <AlertDescription>{historyError}</AlertDescription>
              </Alert>
            </div>
          ) : historyItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t('legal.noHistory')}</div>
          ) : (
            <div className="flex flex-col">
              {historyItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`border-b px-4 py-3 text-left transition last:border-b-0 ${
                    activeHistoryId === item.id
                      ? 'bg-[#0f2a5e] text-white'
                      : 'hover:bg-primary/5'
                  }`}
                  onClick={() => {
                    setActiveHistoryId(item.id);
                    setReviewResult(item.review_result);
                    setError('');
                  }}
                >
                  <div className="truncate text-sm font-medium">{item.file_name}</div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Badge
                      variant={getRiskBadgeVariant(item.risk_level)}
                      className={activeHistoryId === item.id ? 'border-white/20 bg-white/15 text-white hover:bg-white/15' : ''}
                    >
                      {item.risk_level || t('legal.unrated')}
                    </Badge>
                    <div className={`text-[11px] ${activeHistoryId === item.id ? 'text-white/70' : 'text-muted-foreground'}`}>
                      {item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : t('legal.noCreatedAt')}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-primary/10 shadow-sm">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              {t('legal.reviewResult')}
            </CardTitle>
            {riskLevel ? <Badge variant={getRiskBadgeVariant(riskLevel)}>{t('legal.riskLevel', { level: riskLevel })}</Badge> : null}
          </div>
          <CardDescription>{t('legal.reviewDescription')}</CardDescription>
        </CardHeader>
        {error ? (
          <div className="px-6 pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('legal.processFailed')}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}
        <CardContent className="min-h-0 flex-1 overflow-y-auto pt-6">
          {reviewResult ? (
            <ScrollArea className="h-full rounded-lg border bg-background">
              <div className="px-5 py-4 text-sm leading-7 text-foreground [&_h1]:mt-6 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:first:mt-0 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:first:mt-0 [&_h3]:mt-5 [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_strong]:font-semibold [&_ul]:my-3">
                <ReactMarkdown>
                  {reviewResult}
                </ReactMarkdown>
              </div>
            </ScrollArea>
          ) : loading ? (
            <div className="rounded-lg border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
              {t('legal.reviewing')}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
              {t('legal.emptyReviewHint')}
            </div>
          )}
        </CardContent>
        <div className="border-t bg-background/95 p-4 backdrop-blur">
          <div className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm">
            <label
              htmlFor="legal-contract-file"
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 transition hover:border-primary/50 hover:bg-primary/10"
            >
              <UploadCloud className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">
                  {selectedFile ? selectedFile.name : t('legal.selectFile')}
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {parsedFile
                    ? parsedFile.originalLength > parsedFile.truncatedLength
                      ? t('legal.parsedCharsSubmitted', { original: parsedFile.originalLength, truncated: parsedFile.truncatedLength })
                      : t('legal.parsedChars', { original: parsedFile.originalLength })
                    : t('legal.fileHelp')}
                </div>
              </div>
              <input
                id="legal-contract-file"
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
              />
            </label>
            <Button onClick={handleReview} loading={loading} loadingText={t('legal.reviewLoading')} className="shrink-0">
              {t('legal.startReview')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ContractReview;
