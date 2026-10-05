import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BUILD } from '@/lib/build';
import { DEMOS } from '../presets';
import DemoBoard from './DemoBoard';
import '../../board/[token]/board.css';
import '../../board/[token]/motion-ad.css';
import './demo.css';

// 업종 데모 — /demo/arven · /demo/beauty · /demo/food. 실제 카운터 화면을 메모리 판으로 돌린다(DB 안 씀)
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const d = DEMOS[slug];
  return { title: d ? `쿠벤팅 데모 · ${d.label}` : '쿠벤팅 데모' };
}

export default async function DemoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!DEMOS[slug]) notFound();
  return <DemoBoard slug={slug} build={BUILD} />;
}
