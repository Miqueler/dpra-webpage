import { getTranslations } from "next-intl/server";

export async function LogoutButton() {
  const t = await getTranslations("auth.profile");

  return (
    <form action="/auth/signout" method="POST">
      <button
        type="submit"
        className="font-display border border-party-cream/40 px-5 py-2 text-xs uppercase tracking-widest text-party-cream/80 hover:border-party-red hover:text-party-red"
      >
        {t("logout")}
      </button>
    </form>
  );
}
