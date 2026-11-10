"use client";
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { RetirementPlanner } from './RetirementPlanner';
import { AllocationBuilder } from './AllocationBuilder';
import styles from './RetirementPlanner.module.css';
export function RetirementWorkspace() {
  const params = useSearchParams();
  const allocation = params.get('view') === 'allocation';
  return <div className={styles.planner}>
    <h1>Retirement</h1>
    <nav className={styles.workspaceTabs} aria-label="Retirement sections">
      <Link href="/retirement" scroll={false} aria-current={!allocation ? 'page' : undefined}>Your plan</Link>
      <Link href="/retirement?view=allocation" scroll={false} aria-current={allocation ? 'page' : undefined}>Build your mix</Link>
    </nav>
    <div hidden={allocation}><RetirementPlanner /></div>
    <div hidden={!allocation}><AllocationBuilder /></div>
  </div>;
}
