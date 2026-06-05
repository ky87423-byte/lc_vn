// 사이트 설정 — 콘텐츠/링크는 전부 이 파일에서 수정
// Cấu hình trang web — chỉnh sửa nội dung/liên kết tại đây

export const SITE = {
  name: "LC Adena VN",
  tagline: "Thu mua Adena Lineage Classic giá cao nhất",
  taglineKo: "리니지클래식 아데나 최고가 매입",
  description:
    "Thu mua Adena Lineage Classic (리니지클래식) cho người chơi Việt Nam. Giá cập nhật theo thời gian thực, thanh toán nhanh chóng và an toàn.",
  // 매입가 = 바로템 최저가(거래가능물품) × (1 - DISCOUNT_RATE)
  // Giá thu mua = giá thấp nhất trên Barotem × (1 - DISCOUNT_RATE)
  discountRate: 0.15,
  // 시세 캐시(초) — Chu kỳ cập nhật giá (giây)
  priceRevalidateSeconds: 300,
  // KRW → VND 환율 실패 시 폴백값 — Tỷ giá dự phòng
  fallbackKrwToVnd: 18.5,
  contact: {
    // TODO: 실제 링크로 교체 — Thay bằng liên kết thật
    zalo: "https://zalo.me/your-zalo-id",
    facebook: "https://www.facebook.com/your-page",
    kakao: "https://open.kakao.com/o/your-open-chat",
  },
} as const;

// 바로템 리니지클래식 게임머니 서버 목록 (opt1 값)
// Danh sách máy chủ Lineage Classic trên Barotem
export interface ServerInfo {
  id: string; // barotem opt1
  nameKo: string;
  nameEn: string;
}

export const SERVERS: ServerInfo[] = [
  { id: "24487", nameKo: "데포로쥬", nameEn: "Deporoju" },
  { id: "24488", nameKo: "켄라우헬", nameEn: "Kenrauhel" },
  { id: "24489", nameKo: "질리언", nameEn: "Zillian" },
  { id: "24490", nameKo: "이실로테", nameEn: "Isilote" },
  { id: "24491", nameKo: "조우", nameEn: "Zoe" },
  { id: "24492", nameKo: "하딘", nameEn: "Hardin" },
  { id: "24493", nameKo: "케레니스", nameEn: "Kerenis" },
  { id: "24494", nameKo: "오웬", nameEn: "Owen" },
  { id: "24495", nameKo: "크리스터", nameEn: "Krister" },
  { id: "24496", nameKo: "아인하사드", nameEn: "Einhasad" },
  { id: "24527", nameKo: "아툰", nameEn: "Atun" },
  { id: "24528", nameKo: "가드리아", nameEn: "Gadria" },
  { id: "24529", nameKo: "군터", nameEn: "Gunter" },
  { id: "24530", nameKo: "아스테어", nameEn: "Astaire" },
  { id: "24531", nameKo: "듀크데필", nameEn: "Duke Depil" },
  { id: "24575", nameKo: "발센", nameEn: "Balsen" },
  { id: "24576", nameKo: "어레인", nameEn: "Arain" },
  { id: "24577", nameKo: "캐스톨", nameEn: "Castol" },
  { id: "24578", nameKo: "세바스챤", nameEn: "Sebastian" },
  { id: "24579", nameKo: "데컨", nameEn: "Deacon" },
  { id: "24609", nameKo: "파아그리오", nameEn: "Pa'agrio" },
  { id: "24610", nameKo: "에바", nameEn: "Eva" },
  { id: "24611", nameKo: "사이하", nameEn: "Saiha" },
  { id: "24612", nameKo: "마프르", nameEn: "Mafru" },
  { id: "24613", nameKo: "린델", nameEn: "Lindel" },
  { id: "25273", nameKo: "하이네", nameEn: "Heine" },
  { id: "25274", nameKo: "로엔그린", nameEn: "Lohengrin" },
  { id: "26022", nameKo: "발라카스", nameEn: "Valakas" },
  { id: "26641", nameKo: "오렌", nameEn: "Oren" },
];
