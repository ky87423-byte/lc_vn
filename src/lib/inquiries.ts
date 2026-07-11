// 광고/제휴 문의 쪽지 — data/inquiries.json에 저장(git 제외). 공개 폼에서 등록,
// 관리자 페이지에서 조회·확인완료 처리. (단일 writer = lc_vn)

import { promises as fs } from "fs";
import path from "path";

const PATH = path.join(process.cwd(), "data", "inquiries.json");

export interface Inquiry {
  id: string;
  ts: number; // 접수 시각(epoch ms)
  title: string;
  content: string;
  telegram: string;
  kakao: string;
  zalo: string;
  wechat: string;
  confirmed: boolean; // 확인완료 여부
}

export async function readInquiries(): Promise<Inquiry[]> {
  try {
    const raw = await fs.readFile(PATH, "utf8");
    const parsed = JSON.parse(raw) as { inquiries?: Inquiry[] };
    return Array.isArray(parsed.inquiries) ? parsed.inquiries : [];
  } catch {
    return [];
  }
}

export async function writeInquiries(list: Inquiry[]): Promise<void> {
  await fs.mkdir(path.dirname(PATH), { recursive: true });
  await fs.writeFile(PATH, JSON.stringify({ inquiries: list }, null, 2), "utf8");
}

const clip = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** 공개 폼 입력 정규화 — 제목/내용 중 하나는 있어야 함 */
export async function addInquiry(input: unknown): Promise<boolean> {
  if (!input || typeof input !== "object") return false;
  const o = input as Record<string, unknown>;
  const title = clip(o.title, 120);
  const content = clip(o.content, 3000);
  const telegram = clip(o.telegram, 120);
  const kakao = clip(o.kakao, 120);
  const zalo = clip(o.zalo, 120);
  const wechat = clip(o.wechat, 120);
  if (!title && !content && !telegram && !kakao && !zalo && !wechat) return false;
  const list = await readInquiries();
  list.push({
    id: `iq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    title,
    content,
    telegram,
    kakao,
    zalo,
    wechat,
    confirmed: false,
  });
  await writeInquiries(list.slice(-500)); // 최근 500개만 보관
  return true;
}
