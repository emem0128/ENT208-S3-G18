import { useMemo, useState } from 'react';
import { Copy, FileText } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from 'react-i18next';

interface ContractTemplateItem {
  key: string;
  title: string;
  content: string;
}

const CONTRACT_TEMPLATES: ContractTemplateItem[] = [
  {
    key: 'transport-cooperation',
    title: '运输合作协议模板',
    content: `
运输合作协议

甲方：马上国际
乙方：________________

一、合作内容
1. 乙方根据甲方委托承接跨境物流运输、装卸、中转、交接等服务。
2. 乙方应按照甲方指令完成中国段运输、口岸衔接及与越南段/东南亚段承运方的交接配合。

二、责任承担
1. 乙方对其承运区段内货物灭失、短少、污染、损坏、延误承担赔偿责任。
2. 若甲方因乙方违约向客户承担赔偿、折价、退款、违约金或其他损失，乙方应向甲方全额赔偿，并承担甲方为追偿产生的合理费用。
3. 未经甲方书面同意，乙方不得擅自分包。经同意分包的，乙方仍对分包方行为承担连带责任。

三、签收与验货
1. 收货人签收不视为乙方当然免责；隐蔽货损、数量短少等情形仍可在约定期限内提出异议。
2. 乙方应保留运输轨迹、交接单、签收单、照片、视频等证据材料，不得以资料缺失对抗索赔。

四、争议解决
1. 本协议适用中华人民共和国法律。
2. 因本协议产生的争议，由甲方所在地人民法院管辖。
    `.trim(),
  },
  {
    key: 'subcontract-carrier',
    title: '分包承运协议模板',
    content: `
分包承运协议

甲方：马上国际
乙方：________________

一、分包范围
1. 乙方承接甲方指定越南段/东南亚段运输任务，具体以派车单、委托单或邮件通知为准。
2. 乙方应保证其实际承运人、司机、车辆、仓储节点均具备合法资质。

二、追偿与赔偿
1. 乙方确认：凡因乙方或乙方下游承运人原因导致的货损、货差、延误、错运、海关异常、单证缺失等，乙方应向甲方承担全部赔偿责任。
2. 乙方的赔偿责任不以运费金额为限，不得低于甲方对客户已承担或应承担的赔偿责任。
3. 如客户直接向甲方索赔，甲方有权先行赔付后向乙方追偿，乙方应在收到通知后 5 个工作日内支付。

三、不可抗力
1. 不可抗力仅限不可预见、不可避免、不可克服的客观事件。
2. 人员不足、车辆调度异常、分包商违约、常规拥堵、普通清关延迟、燃油价格波动等均不构成不可抗力。

四、证据义务
1. 乙方应在事故发生后 24 小时内书面通知甲方并提交现场照片、视频、签收记录、异常说明。
2. 乙方未按时提交证据的，由此导致的举证不利后果由乙方承担。
    `.trim(),
  },
  {
    key: 'cargo-damage-confirmation',
    title: '货损赔偿确认书模板',
    content: `
货损赔偿确认书

确认方：________________
受偿方：马上国际

鉴于双方就以下运输业务发生货损争议：
1. 运单/单号：________________
2. 运输区段：________________
3. 事故时间：________________
4. 货损情况：________________

现确认如下：
1. 确认方认可上述事故责任由其承担。
2. 确认方向马上国际支付赔偿款人民币/美元________________。
3. 赔偿范围包括货值损失、客户索赔款、重运费用、仓储费用、律师费及其他合理支出。
4. 赔偿款应于____年__月__日前支付至马上国际指定账户。
5. 如逾期未支付，确认方应另行承担违约金及催收成本。

确认方签章：________________
日期：________________
    `.trim(),
  },
  {
    key: 'collection-claim-letter',
    title: '催款/索赔函模板',
    content: `
催款/索赔函

致：________________

就贵司承接的________________运输业务，因________________，已导致马上国际对客户承担/可能承担如下损失：
1. 货损/灭失金额：________________
2. 延误或违约损失：________________
3. 其他费用：________________

根据双方签署的《________________》及相关委托单、交接记录，贵司应承担相应赔偿责任。现正式通知如下：
1. 请于收到本函后 3 个工作日内确认责任并提交书面回复。
2. 请于收到本函后 5 个工作日内支付赔偿/应付款合计：________________。
3. 如逾期未履行，马上国际将采取包括但不限于暂停合作、扣减应付款、提起诉讼/仲裁等措施。

请贵司重视并尽快处理。

马上国际
联系人：________________
日期：________________
    `.trim(),
  },
];

const ContractTemplates = () => {
  const { t } = useTranslation();
  const [activeTemplateKey, setActiveTemplateKey] = useState(CONTRACT_TEMPLATES[0]?.key ?? '');

  const activeTemplate = useMemo(
    () => CONTRACT_TEMPLATES.find((item) => item.key === activeTemplateKey) ?? CONTRACT_TEMPLATES[0],
    [activeTemplateKey]
  );

  const handleCopy = async () => {
    if (!activeTemplate) {
      return;
    }

    try {
      await navigator.clipboard.writeText(activeTemplate.content);
      toast.success(t('legal.templateCopied'));
    } catch (error) {
      console.error('复制模板失败:', error);
      toast.error(t('legal.copyFailed'));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <Card className="border-primary/10 shadow-sm">
        <CardHeader>
          <CardTitle>{t('legal.templateList')}</CardTitle>
          <CardDescription>{t('legal.templateListDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {CONTRACT_TEMPLATES.map((template) => (
            <Button
              key={template.key}
              type="button"
              variant={template.key === activeTemplateKey ? 'default' : 'outline'}
              className="justify-start"
              onClick={() => setActiveTemplateKey(template.key)}
            >
              <FileText className="h-4 w-4" />
              {template.title}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card className="border-primary/10 shadow-sm">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{activeTemplate?.title ?? t('legal.contractTemplates')}</CardTitle>
              <CardDescription>{t('legal.templateDescription')}</CardDescription>
            </div>
            <Button variant="outline" onClick={handleCopy} disabled={!activeTemplate}>
              <Copy className="h-4 w-4" />
              {t('legal.copyTemplate')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {activeTemplate ? (
            <ScrollArea className="h-[620px] rounded-lg border bg-background">
              <pre className="whitespace-pre-wrap px-5 py-4 text-sm leading-7 text-foreground">
                {activeTemplate.content}
              </pre>
            </ScrollArea>
          ) : (
            <div className="rounded-lg border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
              {t('legal.noTemplates')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ContractTemplates;
