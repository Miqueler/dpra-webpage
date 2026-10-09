import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { PosterCard, SectionHeading } from "@/components/ui/PosterCard";
import { AddFriendForm } from "@/components/atzar/AddFriendForm";
import { AcceptFriendButton } from "@/components/atzar/AcceptFriendButton";
import type { Rank } from "@/lib/ranks";

type MiniProfile = { id: string; username: string; avatar_url: string | null; rank: Rank };

export default async function AtzarFriendsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    redirect({ href: "/login", locale });
  }
  const me = auth.user!.id;

  const t = await getTranslations("atzar.friends");
  const tRanks = await getTranslations("common.ranks");

  const { data: friendshipRows } = await supabase
    .from("friendships")
    .select("*")
    .or(`user_id.eq.${me},friend_id.eq.${me}`);

  const rows = friendshipRows ?? [];
  const accepted = rows.filter((r) => r.status === "accepted");
  const incoming = rows.filter((r) => r.status === "pending" && r.friend_id === me);
  const outgoing = rows.filter((r) => r.status === "pending" && r.user_id === me);

  const otherIds = Array.from(
    new Set(rows.map((r) => (r.user_id === me ? r.friend_id : r.user_id)))
  );

  let profileMap = new Map<string, MiniProfile>();
  if (otherIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, rank")
      .in("id", otherIds);
    profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  }

  function renderProfile(id: string) {
    const p = profileMap.get(id);
    return (
      <div className="flex items-center gap-3">
        {p?.avatar_url && (
          <Image
            src={p.avatar_url}
            alt={p.username}
            width={32}
            height={32}
            className="h-8 w-8 border border-atzar-gold/30 object-cover"
          />
        )}
        <div>
          <p className="text-sm text-party-cream">{p?.username ?? "—"}</p>
          {p?.rank && (
            <p className="text-xs uppercase tracking-widest text-party-cream/40">
              {tRanks(p.rank)}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />
      <p className="mb-8 -mt-4 text-sm text-party-cream/60">{t("intro")}</p>

      <PosterCard className="mb-6 border-atzar-gold/25 bg-atzar-black/60">
        <p className="font-display mb-3 text-xs uppercase tracking-widest text-atzar-gold">
          {t("add.title")}
        </p>
        <AddFriendForm meId={me} />
      </PosterCard>

      <PosterCard className="mb-6 border-atzar-gold/25 bg-atzar-black/60">
        <p className="mb-4 text-xs uppercase tracking-widest text-party-cream/50">
          {t("pending.title")}
        </p>
        {incoming.length === 0 ? (
          <p className="text-sm text-party-cream/50">{t("pending.empty")}</p>
        ) : (
          <ul className="divide-y divide-atzar-gold/10">
            {incoming.map((req) => (
              <li
                key={req.id}
                className="flex items-center justify-between py-3"
              >
                {renderProfile(req.user_id)}
                <AcceptFriendButton requestId={req.id} />
              </li>
            ))}
          </ul>
        )}
      </PosterCard>

      <PosterCard className="mb-6 border-atzar-gold/25 bg-atzar-black/60">
        <p className="mb-4 text-xs uppercase tracking-widest text-party-cream/50">
          {t("outgoing.title")}
        </p>
        {outgoing.length === 0 ? (
          <p className="text-sm text-party-cream/50">{t("outgoing.empty")}</p>
        ) : (
          <ul className="divide-y divide-atzar-gold/10">
            {outgoing.map((req) => (
              <li
                key={req.id}
                className="flex items-center justify-between py-3"
              >
                {renderProfile(req.friend_id)}
                <p className="text-xs uppercase tracking-widest text-party-cream/40">
                  {t("outgoing.waiting")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </PosterCard>

      <PosterCard className="border-atzar-gold/25 bg-atzar-black/60">
        <p className="mb-4 text-xs uppercase tracking-widest text-party-cream/50">
          {t("accepted.title")}
        </p>
        {accepted.length === 0 ? (
          <p className="text-sm text-party-cream/50">{t("accepted.empty")}</p>
        ) : (
          <ul className="divide-y divide-atzar-gold/10">
            {accepted.map((row) => (
              <li key={row.id} className="py-3">
                {renderProfile(row.user_id === me ? row.friend_id : row.user_id)}
              </li>
            ))}
          </ul>
        )}
      </PosterCard>
    </div>
  );
}
