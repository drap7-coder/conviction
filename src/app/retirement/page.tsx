import { Suspense } from 'react';
import { PortfolioDataProvider } from '@/components/PortfolioData';
import { RetirementWorkspace } from '@/components/RetirementWorkspace';
import { pageMetadata } from '@/lib/seo';
import '@/app/portfolio.css';
export const metadata = pageMetadata({ title: 'Retirement', description: 'Explore your retirement journey and build an investment mix.', path: '/retirement' });
export default function RetirementPage() {
  return <main className="portfolio-page"><Suspense fallback={null}><PortfolioDataProvider><RetirementWorkspace /></PortfolioDataProvider></Suspense></main>;
}
