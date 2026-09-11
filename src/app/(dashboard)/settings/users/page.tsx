import Link from "next/link";

export default function SettingsUsersPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Users</h1>
      <p className="mt-2 text-gray-500">
        User accounts, roles and profiles are managed from the People module, so employee data
        never lives in two places at once.
      </p>
      <Link
        href="/people"
        className="mt-5 inline-flex rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
      >
        Go to People →
      </Link>
      <p className="mt-6 text-sm text-gray-500">
        To configure what each role is allowed to do, see{" "}
        <Link href="/settings/permissions" className="font-medium text-gray-800 underline">
          Roles &amp; Permissions
        </Link>.
      </p>
    </div>
  );
}
