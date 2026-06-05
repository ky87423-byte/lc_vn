import PriceTable from "@/components/PriceTable";
import { SITE } from "@/data/site";

const STEPS = [
  {
    title: "1. Kiểm tra giá",
    titleKo: "시세 확인",
    desc: "Xem giá thu mua theo máy chủ trong bảng giá thời gian thực bên dưới.",
  },
  {
    title: "2. Liên hệ",
    titleKo: "연락",
    desc: "Nhắn tin qua Zalo / Facebook kèm tên máy chủ và số lượng Adena muốn bán.",
  },
  {
    title: "3. Giao dịch trong game",
    titleKo: "게임 내 거래",
    desc: "Hẹn địa điểm trong game và chuyển Adena trực tiếp cho chúng tôi.",
  },
  {
    title: "4. Nhận tiền ngay",
    titleKo: "즉시 입금",
    desc: "Thanh toán ngay lập tức qua chuyển khoản ngân hàng Việt Nam sau khi xác nhận.",
  },
];

const FAQS = [
  {
    q: "Giá thu mua được tính như thế nào?",
    a: `Chúng tôi theo dõi giá bán thấp nhất theo thời gian thực trên sàn giao dịch Hàn Quốc và thu mua với mức thấp hơn ${Math.round(
      SITE.discountRate * 100
    )}%. Bảng giá tự động cập nhật.`,
  },
  {
    q: "Thanh toán bằng cách nào?",
    a: "Chuyển khoản ngân hàng Việt Nam (VND) ngay sau khi hoàn tất giao dịch trong game. Không giữ tiền, không trì hoãn.",
  },
  {
    q: "Số lượng tối thiểu là bao nhiêu?",
    a: "Vui lòng liên hệ để biết số lượng tối thiểu theo từng máy chủ. Số lượng lớn có thể thương lượng giá tốt hơn.",
  },
  {
    q: "Giao dịch có an toàn không?",
    a: "Giao dịch trực tiếp 1:1 trong game, thanh toán ngay khi nhận Adena. Bạn có thể bán thử số lượng nhỏ trước để kiểm tra.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-20">
      {/* Hero */}
      <section className="py-14 text-center">
        <p className="mb-2 text-sm font-semibold tracking-widest text-amber-500">
          LINEAGE CLASSIC (리니지 클래식)
        </p>
        <h1 className="text-3xl font-extrabold leading-tight text-zinc-50 sm:text-5xl">
          {SITE.tagline}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
          {SITE.description}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={SITE.contact.zalo}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-amber-500 px-6 py-3 font-bold text-zinc-950 hover:bg-amber-400"
          >
            Liên hệ Zalo
          </a>
          <a
            href={SITE.contact.facebook}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-zinc-700 px-6 py-3 font-semibold text-zinc-100 hover:border-amber-500 hover:text-amber-400"
          >
            Facebook
          </a>
          <a
            href="#price"
            className="rounded-lg border border-zinc-700 px-6 py-3 font-semibold text-zinc-100 hover:border-amber-500 hover:text-amber-400"
          >
            Xem bảng giá ↓
          </a>
        </div>
      </section>

      {/* Price table */}
      <section id="price" className="scroll-mt-8 py-10">
        <h2 className="mb-1 text-2xl font-bold text-zinc-50">
          Bảng giá thu mua theo máy chủ
        </h2>
        <p className="mb-6 text-sm text-zinc-400">
          서버별 실시간 매입 시세 — cập nhật tự động theo thời gian thực
        </p>
        <PriceTable />
      </section>

      {/* How it works */}
      <section className="py-10">
        <h2 className="mb-6 text-2xl font-bold text-zinc-50">
          Quy trình giao dịch <span className="text-zinc-500">(거래 절차)</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div
              key={s.title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
            >
              <h3 className="font-bold text-amber-400">
                {s.title}{" "}
                <span className="text-xs font-normal text-zinc-500">
                  {s.titleKo}
                </span>
              </h3>
              <p className="mt-2 text-sm text-zinc-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-10">
        <h2 className="mb-6 text-2xl font-bold text-zinc-50">
          Câu hỏi thường gặp <span className="text-zinc-500">(FAQ)</span>
        </h2>
        <div className="space-y-3">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
            >
              <summary className="cursor-pointer font-semibold text-zinc-100 group-open:text-amber-400">
                {f.q}
              </summary>
              <p className="mt-3 text-sm text-zinc-400">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent p-8 text-center">
        <h2 className="text-2xl font-bold text-zinc-50">
          Sẵn sàng bán Adena?
        </h2>
        <p className="mt-2 text-zinc-400">
          Liên hệ ngay — phản hồi nhanh, thanh toán ngay lập tức.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href={SITE.contact.zalo}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-amber-500 px-6 py-3 font-bold text-zinc-950 hover:bg-amber-400"
          >
            Zalo
          </a>
          <a
            href={SITE.contact.facebook}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-zinc-700 px-6 py-3 font-semibold text-zinc-100 hover:border-amber-500 hover:text-amber-400"
          >
            Facebook
          </a>
          <a
            href={SITE.contact.kakao}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-zinc-700 px-6 py-3 font-semibold text-zinc-100 hover:border-amber-500 hover:text-amber-400"
          >
            KakaoTalk
          </a>
        </div>
      </section>

      <footer className="pt-12 text-center text-xs text-zinc-600">
        © {new Date().getFullYear()} {SITE.name}. Giá tham khảo theo thị
        trường, có thể thay đổi không báo trước.
      </footer>
    </main>
  );
}
