import { Card } from "../ui";

export function PageStateNotice({ title, message }) {
  return (
    <Card className="p-8">
      <p className="section-title">{title}</p>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{message}</p>
    </Card>
  );
}
