import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BUILD } from '@/lib/build';
import { DEMOS } from '../presets';
import DemoBoard from './DemoBoard';
import '../../board/[token]/board.css';
import '../../board/[token]/motion-ad.css';
import './demo.css';

// 업종 데모 — /demo/arven · /demo/beauty · /demo/food · /demo/cafe · /demo/chicken. 실제 카운터 화면을 메모리 판으로 돌린다(DB 안 씀)
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const d = DEMOS[slug];
  return { title: d ? `쿠벤팅 데모 · ${d.label}` : '쿠벤팅 데모' };
}

// ?quick=open — 홈페이지 첫 화면에 얹는 빠른 열기(표부터) · ?quick=1 — 대기 화면에서 누르면 바로 열기 · &sound=1 — 소리 켜고 시작
export default async function DemoPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  if (!DEMOS[slug]) notFound();
  const sp = await searchParams;
  const quick = sp.quick === 'open' ? 'open' : sp.quick ? 'tap' : undefined;
  return <DemoBoard slug={slug} build={BUILD} quick={quick} sound={sp.sound === '1'} />;
}
