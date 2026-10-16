"use client";

import { type FormEvent, useState } from "react";
import { BookOpenText, MessageCircleMore, Send, ShieldCheck, Sparkles } from "lucide-react";

type Citation = { id: string; title: string; source: string; excerpt: string };

export function FloodTwinHelpChat({ authenticated, onLogin }: { authenticated: boolean; onLogin: () => void }) {
  const [question, setQuestion] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Citation[]>([]);
  const [model, setModel] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authenticated) { onLogin(); return; }
    setBusy(true);
    setError("");
    setAnswer("");
    setSources([]);
    setModel("");
    try {
      const response = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, consent }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Chưa trả lời được câu hỏi.");
      if (typeof body.answer !== "string" || !Array.isArray(body.sources)) throw new Error("Phản hồi trợ lý không đúng định dạng.");
      setAnswer(body.answer as string);
      setSources(body.sources as Citation[]);
      setModel(typeof body.returnedModel === "string" ? body.returnedModel : "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không kết nối được trợ lý.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel help-chat-panel" aria-labelledby="help-chat-title">
      <div className="panel-header">
        <div><p className="panel-overline">FLOODTWIN · HỎI ĐÁP CÓ NGUỒN</p><h2 id="help-chat-title">Trợ lý hướng dẫn sản phẩm</h2></div>
        <MessageCircleMore size={21} />
      </div>
      <p className="panel-caption">Hỏi về cách dùng và giới hạn của FLOODTWIN. Câu trả lời chỉ dựa trên tài liệu sản phẩm đã chọn, không cung cấp tình trạng ngập hiện thời.</p>
      <form className="help-chat-form" onSubmit={(event) => void submit(event)}>
        <label htmlFor="floodtwin-help-question">Câu hỏi</label>
        <textarea id="floodtwin-help-question" rows={3} maxLength={600} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ví dụ: FloodPath có xác nhận tuyến an toàn không?" />
        <label className="consent-row"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>Tôi đồng ý gửi câu hỏi và đoạn tài liệu liên quan tới DeepSeek. Không gửi báo cáo riêng tư hay ảnh.</span></label>
        <div className="help-chat-actions">
          {!authenticated ? <span><ShieldCheck size={14} /> Đăng nhập để hỏi trợ lý</span> : <span><BookOpenText size={14} /> Tối đa 3 nguồn từ tài liệu FLOODTWIN</span>}
          {!authenticated
            ? <button className="secondary-button" type="button" onClick={onLogin}>Đăng nhập</button>
            : <button className="primary-button" type="submit" disabled={!consent || question.trim().length < 4 || busy}><Send size={14} />{busy ? "Đang tìm nguồn…" : "Hỏi trợ lý"}</button>}
        </div>
      </form>
      {error ? <div className="inline-notice error-notice" role="alert">{error}</div> : null}
      {answer ? <div className="help-chat-answer" aria-live="polite"><div className="help-chat-answer-title"><Sparkles size={15} /><b>Trả lời có nguồn</b>{model ? <small>{model}</small> : null}</div><p>{answer}</p>{sources.length > 0 ? <div className="help-chat-sources"><b>Nguồn được truy xuất</b>{sources.map((source) => <span key={source.id}><BookOpenText size={13} /><span><b>{source.title}</b><small>{source.source}</small><small>{source.excerpt}</small></span></span>)}</div> : <small>Không tìm thấy tài liệu phù hợp; không gọi mô hình cho câu hỏi này.</small>}</div> : null}
      <p className="help-chat-limit">Không dùng trợ lý để xác định đường đang ngập, chọn tuyến an toàn hoặc thay thế hướng dẫn của cơ quan chức năng.</p>
    </section>
  );
}
