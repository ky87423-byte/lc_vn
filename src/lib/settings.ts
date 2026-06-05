// 런타임 설정 — data/settings.json 파일에 저장 (git 제외)
import { promises as fs } from "fs";
import path from "path";
import { SITE } from "@/data/site";

const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

export const MIN_DISCOUNT_PERCENT = 1;
export const MAX_DISCOUNT_PERCENT = 30;

export interface AppSettings {
  /** 매입 할인율 % (1~30) — 매입가 = 시세 × (1 - discountPercent/100) */
  discountPercent: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  discountPercent: Math.round(SITE.discountRate * 100),
};

export function clampDiscountPercent(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.discountPercent;
  return Math.min(MAX_DISCOUNT_PERCENT, Math.max(MIN_DISCOUNT_PERCENT, Math.round(n)));
}

export async function readSettings(): Promise<AppSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      discountPercent: clampDiscountPercent(
        Number(parsed.discountPercent ?? DEFAULT_SETTINGS.discountPercent)
      ),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function writeSettings(settings: AppSettings): Promise<void> {
  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await fs.writeFile(
    SETTINGS_PATH,
    JSON.stringify(settings, null, 2),
    "utf8"
  );
}

/** 관리자 비밀번호 — .env.local의 ADMIN_PASSWORD로 설정 */
export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || "lcvn-admin";
}
