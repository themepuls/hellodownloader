'use client';

export function ContentPageClient({ title, body }: { title: string; body: string }) {
  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <h1 className="text-4xl font-bold mb-8">{title}</h1>
      <div className="prose prose-invert max-w-none text-muted-foreground whitespace-pre-wrap leading-relaxed">
        {body}
      </div>
    </div>
  );
}
