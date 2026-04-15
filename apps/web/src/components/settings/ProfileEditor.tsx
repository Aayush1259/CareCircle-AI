import { useMemo, useState } from "react";
import { UploadCloud } from "lucide-react";
import toast from "react-hot-toast";
import { Button, Card, Field, Input, SectionHeader } from "@/components/ui";
import { useAppData } from "@/context/AppDataContext";
import { formatDate } from "@/lib/format";
import { hasText, trimmedText } from "@/lib/validation";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+1 \d{3}-\d{3}-\d{4}$/;

export const formatPhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  const normalized = digits.startsWith("1") ? digits : `1${digits}`;
  const core = normalized.slice(1);
  const area = core.slice(0, 3);
  const middle = core.slice(3, 6);
  const end = core.slice(6, 10);
  if (!area) return "+1 ";
  if (!middle) return `+1 ${area}`;
  if (!end) return `+1 ${area}-${middle}`;
  return `+1 ${area}-${middle}-${end}`;
};

export const ProfileEditor = () => {
  const { bootstrap, request, refresh } = useAppData();

  const [profile, setProfile] = useState(() => ({
    name: bootstrap?.viewer.name ?? "",
    email: bootstrap?.viewer.email ?? "",
    phone: bootstrap?.viewer.phone ? formatPhoneInput(bootstrap.viewer.phone) : "",
    photoUrl: bootstrap?.viewer.photoUrl ?? "",
  }));
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [profileSaving, setProfileSaving] = useState(false);

  const currentSettings = bootstrap?.data.settings.find((item) => item.userId === bootstrap?.viewer.id);

  if (!bootstrap || !currentSettings) return null;

  const profileDirty = useMemo(
    () =>
      profile.name !== bootstrap.viewer.name ||
      profile.email !== bootstrap.viewer.email ||
      trimmedText(profile.phone) !== trimmedText(bootstrap.viewer.phone ? formatPhoneInput(bootstrap.viewer.phone) : "") ||
      profile.photoUrl !== (bootstrap.viewer.photoUrl ?? ""),
    [bootstrap.viewer, profile],
  );

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const result = await request<{ fileUrl: string }>("/uploads/image", {
        method: "POST",
        body: formData,
      });
      setProfile((current) => ({ ...current, photoUrl: result.fileUrl }));
      toast.success("Photo uploaded.");
    } catch {
      toast.error("Failed to upload photo. Please try again.");
    }
  };

  const validateProfile = () => {
    const nextErrors: Record<string, string> = {};
    if (!hasText(profile.name)) nextErrors.name = "Please enter your name.";
    if (!emailPattern.test(trimmedText(profile.email))) nextErrors.email = "Please enter a valid email address.";
    if (hasText(profile.phone) && !phonePattern.test(trimmedText(profile.phone))) nextErrors.phone = "Use the format +1 555-123-4567.";
    setProfileErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const saveProfile = async () => {
    if (!validateProfile()) return;
    setProfileSaving(true);
    try {
      await request("/settings/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: trimmedText(profile.name),
          phone: trimmedText(profile.phone),
          photoUrl: trimmedText(profile.photoUrl),
        }),
      });

      if (trimmedText(profile.email).toLowerCase() !== bootstrap.viewer.email.toLowerCase()) {
        await request("/settings/profile/email-change/request", {
          method: "POST",
          body: JSON.stringify({ email: trimmedText(profile.email).toLowerCase() }),
        });
        toast.success("We emailed a confirmation link for the new address.");
      } else {
        toast.success("Profile saved!");
      }
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <Card>
      <SectionHeader title="Profile Details" description="Keep your contact details and photo up to date." />
      <div className="grid gap-3.5 sm:gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <label className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-borderColor bg-brandSoft text-brandDark sm:h-24 sm:w-24">
            {profile.photoUrl ? (
              <img src={profile.photoUrl} alt="Caregiver profile" className="h-full w-full object-cover" />
            ) : (
              <UploadCloud className="h-7 w-7 sm:h-8 sm:w-8" />
            )}
            <input className="hidden" type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && void uploadImage(event.target.files[0])} />
          </label>
          <div>
            <p className="text-[0.95rem] font-semibold text-textPrimary sm:text-base">Your photo</p>
            <p className="text-[0.85rem] text-textSecondary sm:text-sm">Tap the circle to upload a new image.</p>
          </div>
        </div>
        <Field label="Full name">
          <Input value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} className={profileErrors.name ? "border-danger" : ""} />
          {profileErrors.name ? <p className="mt-2 text-[0.85rem] text-danger sm:text-sm">{profileErrors.name}</p> : null}
        </Field>
        <Field label="Email">
          <Input type="email" value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} className={profileErrors.email ? "border-danger" : ""} />
          {profileErrors.email ? <p className="mt-2 text-[0.85rem] text-danger sm:text-sm">{profileErrors.email}</p> : null}
        </Field>
        <Field label="Phone">
          <Input value={profile.phone} placeholder="+1 555-123-4567" onChange={(event) => setProfile((current) => ({ ...current, phone: formatPhoneInput(event.target.value) }))} className={profileErrors.phone ? "border-danger" : ""} />
          {profileErrors.phone ? <p className="mt-2 text-[0.85rem] text-danger sm:text-sm">{profileErrors.phone}</p> : null}
        </Field>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.85rem] text-textSecondary sm:text-sm">Last updated {currentSettings.updatedAt ? formatDate(currentSettings.updatedAt) : "today"}</p>
          <Button className="w-full sm:w-auto" disabled={!profileDirty || profileSaving} onClick={saveProfile}>
            {profileSaving ? "Saving profile..." : "Save Profile"}
          </Button>
        </div>
      </div>
    </Card>
  );
};
