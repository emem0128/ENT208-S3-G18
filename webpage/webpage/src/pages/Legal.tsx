import MainLayout from '@/components/layouts/MainLayout';
import ContractReview from '@/components/legal/ContractReview';
import ContractTemplates from '@/components/legal/ContractTemplates';
import LegalConsult from '@/components/legal/LegalConsult';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const LegalPage = () => {
  const { t } = useTranslation();

  return (
    <MainLayout>
      <div className="space-y-6">
        <Card className="overflow-hidden border-primary/10 bg-gradient-to-r from-[#0f2a5e] via-[#16408a] to-[#1b4fa6] text-white shadow-sm">
          <CardContent className="flex flex-col gap-4 px-6 py-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{t('legal.title')}</h1>
                <p className="mt-1 text-sm text-white/80">
                  {t('legal.subtitle')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/15 text-white hover:bg-white/15">{t('legal.riskPerspective')}</Badge>
              <Badge className="bg-white/15 text-white hover:bg-white/15">{t('legal.templatesBuiltIn')}</Badge>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="contract-review" className="space-y-4">
          <TabsList className="bg-primary/5">
            <TabsTrigger value="contract-review">{t('legal.contractReview')}</TabsTrigger>
            <TabsTrigger value="legal-consult">{t('legal.legalConsult')}</TabsTrigger>
            <TabsTrigger value="contract-templates">{t('legal.contractTemplates')}</TabsTrigger>
          </TabsList>

          <TabsContent value="contract-review">
            <ContractReview />
          </TabsContent>
          <TabsContent value="legal-consult">
            <LegalConsult />
          </TabsContent>
          <TabsContent value="contract-templates">
            <ContractTemplates />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default LegalPage;
