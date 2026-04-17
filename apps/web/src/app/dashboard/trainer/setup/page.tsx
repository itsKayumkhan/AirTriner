"use client";

import { useEffect, useState, useRef } from "react";
import { getSession, setSession, clearSession, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";
import LocationAutocomplete, { type LocationValue } from "@/components/forms/LocationAutocomplete";
import {
    Pencil,
    FileText,
    Crosshair,
    Briefcase,
    Award,
    DollarSign,
    X,
    FileUp,
    CheckCircle,
    AlertTriangle,
    MapPin,
    Clock,
    Eye,
    Upload,
    Trash2,
    ExternalLink,
    ShieldCheck,
    Plus,
    Camera,
    ChevronDown,
    ChevronUp,
    Image as ImageIcon,
    ShieldAlert
} from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { detectCountry, radiusUnit, miToKm, kmToMi } from "@/lib/units";

const FALLBACK_SPORTS: { id: string; name: string; slug: string }[] = [
    { id: "hockey", name: "Hockey", slug: "hockey" },
    { id: "baseball", name: "Baseball", slug: "baseball" },
    { id: "basketball", name: "Basketball", slug: "basketball" },
    { id: "football", name: "Football", slug: "football" },
    { id: "soccer", name: "Soccer", slug: "soccer" },
    { id: "tennis", name: "Tennis", slug: "tennis" },
    { id: "golf", name: "Golf", slug: "golf" },
    { id: "swimming", name: "Swimming", slug: "swimming" },
    { id: "boxing", name: "Boxing", slug: "boxing" },
    { id: "lacrosse", name: "Lacrosse", slug: "lacrosse" },
    { id: "wrestling", name: "Wrestling", slug: "wrestling" },
    { id: "martial_arts", name: "Martial Arts", slug: "martial_arts" },
    { id: "gymnastics", name: "Gymnastics", slug: "gymnastics" },
    { id: "track_and_field", name: "Track and Field", slug: "track_and_field" },
    { id: "volleyball", name: "Volleyball", slug: "volleyball" },
];

export default function TrainerEditProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [sportsList, setSportsList] = useState<{ id: string; name: string; slug: string }[]>([]);
    const [sportsLoading, setSportsLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [popup, setPopup] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        bio: "",
        sports: [] as string[],
        yearsExperience: "",
        previousFacility: "",
        hourlyRate: "75",
        packageRate: "650",
        certifications: "",
        city: "",
        state: "",
        travelRadius: "20",
        targetSkillLevels: ["beginner", "intermediate", "advanced", "pro"] as ("beginner"|"intermediate"|"advanced"|"pro")[],
        preferredTrainingTimes: ["morning", "afternoon", "evening"] as ("morning"|"afternoon"|"evening")[],
        phone: "",
        zipCode: "",
        country: "",
        dateOfBirth: "",
        sex: "",
    });

    const [displayRadius, setDisplayRadius] = useState("20");

    const [sessionLengths, setSessionLengths] = useState<number[]>([60]);
    const [trainingLocations, setTrainingLocations] = useState<string[]>([]);

    const [newTag, setNewTag] = useState("");
    const [showTagInput, setShowTagInput] = useState(false);

    // Custom session duration input
    const [customDuration, setCustomDuration] = useState("");

    // Multi-day camp offerings (Change 1) — non-consecutive days with individual times
    const [campOfferings, setCampOfferings] = useState<Array<{ name: string; hoursPerDay: number; days: number; totalPrice: number; location: string; startTime: string; endTime: string; dates: string[]; maxSpots: number; spotsRemaining: number; schedule?: Array<{ date: string; startTime: string }> }>>([]);
    const [showCampSection, setShowCampSection] = useState(false);
    const [showCampForm, setShowCampForm] = useState(false);
    const [editingCampIndex, setEditingCampIndex] = useState<number | null>(null);
    const [campForm, setCampForm] = useState({ name: "", hoursPerDay: "", totalPrice: "", location: "", maxSpots: "" });
    const [campSchedule, setCampSchedule] = useState<Array<{ date: string; startTime: string }>>([{ date: "", startTime: "" }]);

    // Profile image upload with admin approval (Change 3)
    const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
    const [profileImageStatus, setProfileImageStatus] = useState<"none"|"pending"|"approved"|"rejected">("none");
    const [profileImageRejectionReason, setProfileImageRejectionReason] = useState<string | null>(null);
    const [imageUploading, setImageUploading] = useState(false);
    const profileImageInputRef = useRef<HTMLInputElement>(null);

    const [requireVerification, setRequireVerification] = useState(true);

    // Verification documents state
    const [verificationDocs, setVerificationDocs] = useState<string[]>([]);
    const [uploadingDoc, setUploadingDoc] = useState(false);

    // File upload refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const docInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchSports = async () => {
            setSportsLoading(true);
            const { data, error } = await supabase
                .from("sports")
                .select("id, name, slug")
                .eq("is_active", true)
                .order("name");
            if (error || !data || data.length === 0) {
                setSportsList(FALLBACK_SPORTS);
            } else {
                setSportsList(data as { id: string; name: string; slug: string }[]);
            }
            setSportsLoading(false);
        };

        fetchSports();

        const session = getSession();
        if (!session) {
            router.push("/auth/login");
            return;
        }
        if (session.role !== "trainer") {
            router.push("/dashboard");
            return;
        }
        setUser(session);

        const fetchData = async () => {
            // Fetch Platform Settings & Latest Profile in parallel
            const [settingsRes, profileRes, userRes] = await Promise.all([
                supabase.from("platform_settings").select("require_trainer_verification").maybeSingle(),
                supabase.from("trainer_profiles").select("*").eq("user_id", session.id).single(),
                supabase.from("users").select("phone, date_of_birth, sex").eq("id", session.id).single()
            ]);
            
            if (settingsRes.data) {
                setRequireVerification(settingsRes.data.require_trainer_verification);
            }

            const latestProfile = profileRes.data;
            if (latestProfile) {
                const updatedSession = { ...session, trainerProfile: latestProfile };
                setUser(updatedSession);
                setSession(updatedSession); // Update local storage too

                let initialCerts = "";
                if (typeof latestProfile.certifications === "string") initialCerts = latestProfile.certifications;
                else if (Array.isArray(latestProfile.certifications)) initialCerts = latestProfile.certifications.join("\n");

                setFormData(prev => ({
                    ...prev,
                    firstName: session.firstName || "",
                    lastName: session.lastName || "",
                    bio: latestProfile.bio || "",
                    sports: latestProfile.sports || [],
                    yearsExperience: latestProfile.years_experience?.toString() || "",
                    hourlyRate: latestProfile.hourly_rate?.toString() || "75",
                    previousFacility: prev.previousFacility,
                    packageRate: prev.packageRate,
                    certifications: initialCerts,
                    city: latestProfile.city || "",
                    state: latestProfile.state || "",
                    travelRadius: latestProfile.travel_radius_miles?.toString() || "20",
                    targetSkillLevels: latestProfile.target_skill_levels || ["beginner", "intermediate", "advanced", "pro"],
                    preferredTrainingTimes: latestProfile.preferredTrainingTimes || ["morning", "afternoon", "evening"],
                    phone: userRes.data?.phone || "",
                    zipCode: latestProfile.zip_code || "",
                    dateOfBirth: userRes.data?.date_of_birth || "",
                    sex: userRes.data?.sex || "",
                }));
                // Show radius in km when Canadian postal code detected
                const storedMiles = latestProfile.travel_radius_miles || 20;
                const loadedZip = latestProfile.zip_code || "";
                const loadedCountry = detectCountry(loadedZip);
                if (loadedCountry === "CA") {
                    setDisplayRadius(String(Math.round(miToKm(storedMiles))));
                } else {
                    setDisplayRadius(String(storedMiles));
                }
                if (latestProfile.session_lengths?.length) setSessionLengths(latestProfile.session_lengths);
                if (latestProfile.training_locations?.length) setTrainingLocations(latestProfile.training_locations);
                if (latestProfile.verification_documents?.length) setVerificationDocs(latestProfile.verification_documents);

                // Load camp offerings (Change 1) — skip silently if column doesn't exist yet
                if (Array.isArray(latestProfile.camp_offerings)) {
                    setCampOfferings(latestProfile.camp_offerings);
                    if (latestProfile.camp_offerings.length > 0) setShowCampSection(true);
                }

                // Load profile image fields (Change 3) — skip silently if columns don't exist yet
                if (latestProfile.profile_image_url) setProfileImageUrl(latestProfile.profile_image_url);
                if (latestProfile.profile_image_status) setProfileImageStatus(latestProfile.profile_image_status);
                if (latestProfile.profile_image_rejection_reason) setProfileImageRejectionReason(latestProfile.profile_image_rejection_reason);
            }
            setLoading(false);
        };

        fetchData();
    }, [router]);

    const handleSaveProfile = async () => {
        if (!user) return;

        // Validate required fields
        const errors: Record<string, string> = {};

        if (!formData.firstName.trim()) errors.firstName = "First name is required";
        else if (formData.firstName.trim().length < 2) errors.firstName = "Must be at least 2 characters";

        if (!formData.lastName.trim()) errors.lastName = "Last name is required";
        else if (formData.lastName.trim().length < 2) errors.lastName = "Must be at least 2 characters";

        if (formData.phone && !/^\+?[\d\s\-()\/.]{10,}$/.test(formData.phone))
            errors.phone = "Enter a valid phone number (10+ digits)";

        if (!formData.sports || formData.sports.length === 0) errors.sports = "Select at least one sport";
        if (!formData.hourlyRate || parseFloat(formData.hourlyRate) <= 0) errors.hourlyRate = "Hourly rate is required";
        if (!formData.yearsExperience) errors.yearsExperience = "Years of experience is required";
        if (!formData.city?.trim()) errors.city = "City is required";
        if (formData.zipCode.trim()) {
            const zipCountry = detectCountry(formData.zipCode);
            if (zipCountry === "OTHER") {
                errors.zipCode = "Enter a valid US ZIP (e.g. 90210) or Canadian postal code (e.g. K0L 1B0)";
            } else if (formData.country && formData.country !== zipCountry) {
                const countryName = formData.country === "CA" ? "Canada" : formData.country === "US" ? "the US" : formData.country;
                errors.zipCode = `Your city is in ${countryName} — postal code doesn't match`;
            }
        }

        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) {
            setPopup({ type: "error", message: "Please fix the highlighted fields before saving." });
            return;
        }

        setSaving(true);
        try {
            const updateData: Record<string, unknown> = {
                bio: formData.bio,
                sports: formData.sports,
                years_experience: Math.max(0, parseInt(formData.yearsExperience) || 0),
                hourly_rate: parseFloat(formData.hourlyRate) || 75,
                certifications: formData.certifications,
                city: formData.city || null,
                state: formData.state || null,
                zip_code: formData.zipCode || null,
                travel_radius_miles: detectCountry(formData.zipCode) === "CA"
                    ? Math.round(kmToMi(parseInt(displayRadius) || 20))
                    : parseInt(displayRadius) || 20,
                target_skill_levels: formData.targetSkillLevels,
                "preferredTrainingTimes": formData.preferredTrainingTimes,
                session_lengths: sessionLengths.length > 0 ? sessionLengths : [60],
                training_locations: trainingLocations,
                camp_offerings: campOfferings,
            };

            const [profileRes, userRes] = await Promise.all([
                supabase.from("trainer_profiles").update(updateData).eq("user_id", user.id),
                supabase.from("users").update({ first_name: formData.firstName, last_name: formData.lastName, phone: formData.phone || null, date_of_birth: formData.dateOfBirth || null, sex: formData.sex || null }).eq("id", user.id)
            ]);

            if (profileRes.error) throw profileRes.error;
            if (userRes.error) throw userRes.error;

            const updatedSession = {
                ...user,
                firstName: formData.firstName,
                lastName: formData.lastName,
                trainerProfile: {
                    ...user.trainerProfile,
                    ...updateData
                },
            };
            setSession(updatedSession as AuthUser);
            setPopup({ type: "success", message: "Profile saved successfully!" });
        } catch (err) {
            console.error("Failed to save:", err);
            setPopup({ type: "error", message: "Failed to save profile. Please try again." });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!user) return;
        setDeleting(true);
        try {
            await supabase.from("users").update({ deleted_at: new Date().toISOString() }).eq("id", user.id);
            await clearSession();
            router.push("/auth/login");
        } catch (err) {
            console.error("Failed to delete account:", err);
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            if (!e.target.files || e.target.files.length === 0 || !user) {
                return;
            }

            const file = e.target.files[0];

            // Upload to Cloudinary
            const result = await uploadToCloudinary(file, "airtrainer/avatars", { resourceType: "image" });
            const avatarUrl = result.url;

            // Updated auth user
            const { error: updateError } = await supabase
                .from('users')
                .update({ avatar_url: avatarUrl })
                .eq('id', user.id);

            if (updateError) throw updateError;

            const updatedUser = { ...user, avatarUrl };
            setUser(updatedUser);
            setSession(updatedUser);

            setPopup({ type: "success", message: "Avatar updated successfully!" });

        } catch (error) {
            console.error('Error uploading image: ', error);
            setPopup({ type: "error", message: "Error uploading image! Please try again." });
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleRemoveAvatar = async () => {
        if (!user || !user.avatarUrl) return;
        try {
            setUploading(true);

            const { error: updateError } = await supabase
                .from('users')
                .update({ avatar_url: null })
                .eq('id', user.id);

            if (updateError) throw updateError;

            const updatedUser = { ...user, avatarUrl: null };
            setUser(updatedUser);
            setSession(updatedUser as AuthUser);

            setPopup({ type: "success", message: "Avatar removed successfully!" });
        } catch (error) {
            console.error('Error removing image: ', error);
            setPopup({ type: "error", message: "Error removing image!" });
        } finally {
            setUploading(false);
        }
    };

    const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !user) return;
        const file = e.target.files[0];

        if (file.type !== "application/pdf") {
            setPopup({ type: "error", message: "Only PDF files are allowed for verification documents." });
            if (docInputRef.current) docInputRef.current.value = "";
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setPopup({ type: "error", message: "File size must be under 10 MB." });
            if (docInputRef.current) docInputRef.current.value = "";
            return;
        }

        setUploadingDoc(true);
        try {
            // Upload PDF to Cloudinary (resource_type: "raw" for non-image files)
            const result = await uploadToCloudinary(file, "airtrainer/documents", { resourceType: "raw" });
            const docUrl = result.url;
            const updatedDocs = [...verificationDocs, docUrl];

            const { error: updateError } = await supabase
                .from("trainer_profiles")
                .update({ verification_documents: updatedDocs })
                .eq("user_id", user.id);

            if (updateError) throw updateError;

            setVerificationDocs(updatedDocs);
            setPopup({ type: "success", message: "Document uploaded successfully. An admin will review it shortly." });
        } catch (err) {
            console.error("Document upload error:", err);
            setPopup({ type: "error", message: "Failed to upload document. Please try again." });
        } finally {
            setUploadingDoc(false);
            if (docInputRef.current) docInputRef.current.value = "";
        }
    };

    const handleRemoveDocument = async (docUrl: string) => {
        if (!user) return;
        const updatedDocs = verificationDocs.filter(d => d !== docUrl);
        try {
            const { error } = await supabase
                .from("trainer_profiles")
                .update({ verification_documents: updatedDocs })
                .eq("user_id", user.id);
            if (error) throw error;
            setVerificationDocs(updatedDocs);
        } catch (err) {
            console.error("Failed to remove document:", err);
            setPopup({ type: "error", message: "Failed to remove document." });
        }
    };

    const handleUploadProfileImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !user) return;
        const file = e.target.files[0];

        const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
            setPopup({ type: "error", message: "Only PNG, JPEG, or WebP images are allowed." });
            if (profileImageInputRef.current) profileImageInputRef.current.value = "";
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setPopup({ type: "error", message: "Image must be under 5 MB." });
            if (profileImageInputRef.current) profileImageInputRef.current.value = "";
            return;
        }

        setImageUploading(true);
        try {
            // Upload profile image to Cloudinary
            const result = await uploadToCloudinary(file, "airtrainer/trainer-profiles", { resourceType: "image" });
            const imageUrl = result.url;

            const { error: updateError } = await supabase
                .from("trainer_profiles")
                .update({
                    profile_image_url: imageUrl,
                    profile_image_status: "pending",
                    profile_image_rejection_reason: null,
                })
                .eq("user_id", user.id);

            if (updateError) throw updateError;

            // Also update users.avatar_url so the image shows across the app
            // (search results, trainer cards, nav bar, etc. all read avatar_url)
            const { error: avatarError } = await supabase
                .from("users")
                .update({ avatar_url: imageUrl })
                .eq("id", user.id);

            if (avatarError) console.error("Failed to sync avatar_url:", avatarError);

            // Update local session so UI reflects immediately
            const updatedUser = { ...user, avatarUrl: imageUrl };
            setUser(updatedUser);
            setSession(updatedUser as AuthUser);

            setProfileImageUrl(imageUrl);
            setProfileImageStatus("pending");
            setProfileImageRejectionReason(null);
            setPopup({ type: "success", message: "Photo uploaded — pending admin approval." });
            toast.success("Photo uploaded!");
        } catch (err: unknown) {
            console.error("Profile image upload error:", err);
            const message = err instanceof Error && err.message?.includes("not found")
                ? "Storage bucket not configured yet. Please contact an administrator."
                : "Failed to upload profile image. Please try again.";
            setPopup({ type: "error", message });
            toast.error(message);
        } finally {
            setImageUploading(false);
            if (profileImageInputRef.current) profileImageInputRef.current.value = "";
        }
    };

    const handleAddCamp = () => {
        const name = campForm.name.trim();
        const hoursPerDay = parseFloat(campForm.hoursPerDay);
        const totalPrice = parseFloat(campForm.totalPrice);
        const location = campForm.location.trim();
        const maxSpots = parseInt(campForm.maxSpots);

        // Filter out empty schedule rows
        const validSchedule = campSchedule.filter(s => s.date.trim() && s.startTime.trim());
        const days = validSchedule.length;

        if (!name || !hoursPerDay || hoursPerDay <= 0 || !totalPrice || totalPrice <= 0) {
            setPopup({ type: "error", message: "Please fill in all camp fields with valid values." });
            return;
        }

        if (!maxSpots || maxSpots <= 0) {
            setPopup({ type: "error", message: "Please enter a valid number of spots." });
            return;
        }

        if (days === 0) {
            setPopup({ type: "error", message: "Please add at least one day with a date and start time." });
            return;
        }

        // Sort schedule by date
        const sortedSchedule = [...validSchedule].sort((a, b) => a.date.localeCompare(b.date));

        // Derive legacy fields from the schedule for backward compatibility
        const firstEntry = sortedSchedule[0];
        const lastEntry = sortedSchedule[sortedSchedule.length - 1];
        const startTime = firstEntry.startTime;
        let endTime = "";
        if (startTime && hoursPerDay) {
            const [h, m] = startTime.split(":").map(Number);
            const totalMins = h * 60 + m + hoursPerDay * 60;
            const eH = Math.floor(totalMins / 60) % 24;
            const eM = Math.round(totalMins % 60);
            endTime = `${String(eH).padStart(2, "0")}:${String(eM).padStart(2, "0")}`;
        }
        const dates = [firstEntry.date, ...(lastEntry.date !== firstEntry.date ? [lastEntry.date] : [])];

        const existingSpotsRemaining = editingCampIndex !== null ? campOfferings[editingCampIndex].spotsRemaining : maxSpots;
        const camp = { name, hoursPerDay, days, totalPrice, location, startTime, endTime, dates, maxSpots, spotsRemaining: editingCampIndex !== null ? Math.min(existingSpotsRemaining, maxSpots) : maxSpots, schedule: sortedSchedule };

        if (editingCampIndex !== null) {
            setCampOfferings(prev => prev.map((c, i) => i === editingCampIndex ? camp : c));
            setEditingCampIndex(null);
        } else {
            setCampOfferings(prev => [...prev, camp]);
        }
        setCampForm({ name: "", hoursPerDay: "", totalPrice: "", location: "", maxSpots: "" });
        setCampSchedule([{ date: "", startTime: "" }]);
        setShowCampForm(false);
    };

    const handleEditCamp = (index: number) => {
        const camp = campOfferings[index];
        setCampForm({
            name: camp.name,
            hoursPerDay: camp.hoursPerDay.toString(),
            totalPrice: camp.totalPrice.toString(),
            location: camp.location || "",
            maxSpots: camp.maxSpots?.toString() || "",
        });
        // Load schedule if present, otherwise reconstruct from legacy fields
        if (camp.schedule && camp.schedule.length > 0) {
            setCampSchedule(camp.schedule.map(s => ({ date: s.date, startTime: s.startTime })));
        } else if (camp.dates?.[0]) {
            setCampSchedule([{ date: camp.dates[0], startTime: camp.startTime || "" }]);
        } else {
            setCampSchedule([{ date: "", startTime: "" }]);
        }
        setEditingCampIndex(index);
        setShowCampForm(true);
    };

    const handleRemoveCamp = (index: number) => {
        setCampOfferings(prev => prev.filter((_, i) => i !== index));
    };

    const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && newTag.trim() !== "") {
            e.preventDefault();
            const tag = newTag.trim().toUpperCase();
            if (!formData.sports.includes(tag)) {
                setFormData({ ...formData, sports: [...formData.sports, tag] });
            }
            setNewTag("");
            setShowTagInput(false);
        }
    };

    const removeTag = (tag: string) => {
        setFormData({ ...formData, sports: formData.sports.filter(s => s !== tag) });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-[1000px] w-full pb-12">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-[32px] font-black font-display italic tracking-wide text-white uppercase mb-1 leading-none drop-shadow-sm">
                        EDIT PROFILE
                    </h1>
                    <p className="text-text-main/60 font-medium text-15px">
                        Enhance your visibility to prospective athletes.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {user?.id && (
                        <a
                            href={`/dashboard/trainers/${user.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-text-main/50 font-bold text-xs hover:bg-white/5 hover:text-white transition-all"
                        >
                            <Eye size={13} strokeWidth={2} />
                            Preview
                        </a>
                    )}
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="px-4 py-2 rounded-xl border border-white/10 text-text-main/50 font-bold text-xs hover:bg-white/5 hover:text-white transition-colors"
                    >
                        Discard
                    </button>
                    <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="px-6 py-2.5 rounded-xl bg-primary text-bg font-black text-xs uppercase tracking-wider hover:shadow-[0_0_15px_rgba(69,208,255,0.3)] transition-all flex items-center gap-2 disabled:bg-primary/50"
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>

            {/* Verification Notice */}
            {requireVerification && user?.trainerProfile && !user.trainerProfile.is_verified && (
                <div className="mb-8 p-6 bg-blue-500/10 border border-blue-500/20 rounded-[24px] flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center shrink-0">
                        <AlertTriangle className="text-blue-400 w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-blue-400 font-bold text-lg mb-1">Profile Verification Required</h3>
                        <p className="text-text-main/70 text-sm leading-relaxed max-w-2xl">
                            Your profile is currently hidden from athletes because the platform requires admin verification. 
                            Complete your profile details below, and an admin will review your account for approval.
                        </p>
                    </div>
                </div>
            )}

            {/* Profile Photo (Change 3) */}
            <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md mb-6">
                <div className="flex items-center gap-3 mb-6">
                    <Camera size={20} className="text-primary" strokeWidth={2.5} />
                    <div>
                        <h3 className="text-[15px] font-black text-white tracking-widest uppercase">PROFILE PHOTO</h3>
                        <p className="text-[11px] text-text-main/40 font-medium mt-0.5">Upload a professional photo. Reviewed by admin before display.</p>
                    </div>
                </div>

                <div className="flex items-start gap-6">
                    {/* Preview */}
                    <div className="shrink-0">
                        {profileImageUrl ? (
                            <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-white/10 relative">
                                <img src={profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                                {imageUploading && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-2xl">
                                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center bg-[#12141A] relative">
                                {imageUploading ? (
                                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <ImageIcon size={32} className="text-text-main/20" />
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex-1 space-y-3">
                        {/* Status badge */}
                        {profileImageStatus === "none" && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 text-text-main/50 text-xs font-bold">
                                No photo uploaded
                            </span>
                        )}
                        {profileImageStatus === "pending" && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
                                <Clock size={12} /> Pending admin approval
                            </span>
                        )}
                        {profileImageStatus === "approved" && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                                <CheckCircle size={12} /> Approved
                            </span>
                        )}
                        {profileImageStatus === "rejected" && (
                            <div className="space-y-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold">
                                    <AlertTriangle size={12} /> Rejected{profileImageRejectionReason ? `: ${profileImageRejectionReason}` : ""}
                                </span>
                            </div>
                        )}

                        {/* Upload zone */}
                        {(profileImageStatus === "none" || profileImageStatus === "rejected") && (
                            <div
                                onClick={() => !imageUploading && profileImageInputRef.current?.click()}
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (imageUploading) return;
                                    if (e.dataTransfer.files?.length && profileImageInputRef.current) {
                                        const dt = new DataTransfer();
                                        dt.items.add(e.dataTransfer.files[0]);
                                        profileImageInputRef.current.files = dt.files;
                                        profileImageInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
                                    }
                                }}
                                className={`flex flex-col items-center justify-center py-6 px-4 border border-dashed border-white/10 rounded-xl transition-all text-center ${imageUploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-primary/30 hover:bg-primary/5"}`}
                            >
                                {imageUploading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                                        <p className="text-text-main/50 text-xs font-medium">Uploading...</p>
                                    </>
                                ) : (
                                    <>
                                        <Upload size={20} className="text-text-main/30 mb-2" />
                                        <p className="text-text-main/50 text-xs font-medium">Drag & drop or click to upload</p>
                                        <p className="text-text-main/30 text-[10px] mt-1">PNG, JPEG, or WebP — max 5 MB</p>
                                    </>
                                )}
                            </div>
                        )}

                        {profileImageStatus === "pending" && (
                            <p className="text-text-main/40 text-xs">Your photo is awaiting admin review. You can re-upload to replace it.</p>
                        )}

                        {(profileImageStatus === "pending" || profileImageStatus === "approved") && (
                            <button
                                type="button"
                                onClick={() => profileImageInputRef.current?.click()}
                                disabled={imageUploading}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-text-main/60 text-xs font-bold hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
                            >
                                {imageUploading ? (
                                    <><div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Uploading...</>
                                ) : (
                                    <><Upload size={14} /> Replace Photo</>
                                )}
                            </button>
                        )}

                        <input
                            ref={profileImageInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={handleUploadProfileImage}
                        />
                    </div>
                </div>
            </div>

            {/* Content Blocks */}
            <div className="space-y-6">

                {/* Profile Identity - Temporarily hidden per user request
                <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-8 shadow-md">
                    <div className="relative shrink-0">
                        ...
                    </div>
                </div>
                */}

                {/* Personal Information */}
                <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">First Name <span className="text-red-400">*</span></label>
                            <input
                                value={formData.firstName}
                                onChange={(e) => { setFormData((p) => ({ ...p, firstName: e.target.value })); setFieldErrors((p) => { const n = { ...p }; delete n.firstName; return n; }); }}
                                className={`w-full bg-[#12141A] border rounded-2xl px-5 py-3.5 text-white text-sm outline-none transition-colors ${fieldErrors.firstName ? "border-red-500/50 focus:border-red-500/70" : "border-white/5 focus:border-primary/50"}`}
                            />
                            {fieldErrors.firstName && <p className="mt-1.5 text-[11px] text-red-400 font-semibold flex items-center gap-1"><AlertTriangle size={11} /> {fieldErrors.firstName}</p>}
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Last Name <span className="text-red-400">*</span></label>
                            <input
                                value={formData.lastName}
                                onChange={(e) => { setFormData((p) => ({ ...p, lastName: e.target.value })); setFieldErrors((p) => { const n = { ...p }; delete n.lastName; return n; }); }}
                                className={`w-full bg-[#12141A] border rounded-2xl px-5 py-3.5 text-white text-sm outline-none transition-colors ${fieldErrors.lastName ? "border-red-500/50 focus:border-red-500/70" : "border-white/5 focus:border-primary/50"}`}
                            />
                            {fieldErrors.lastName && <p className="mt-1.5 text-[11px] text-red-400 font-semibold flex items-center gap-1"><AlertTriangle size={11} /> {fieldErrors.lastName}</p>}
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Email</label>
                            <input
                                value={user?.email || ""}
                                readOnly
                                className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white/50 text-sm outline-none cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Phone Number</label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => { setFormData((p) => ({ ...p, phone: e.target.value })); setFieldErrors((p) => { const n = { ...p }; delete n.phone; return n; }); }}
                                placeholder="(555) 123-4567"
                                className={`w-full bg-[#12141A] border rounded-2xl px-5 py-3.5 text-white text-sm outline-none transition-colors ${fieldErrors.phone ? "border-red-500/50 focus:border-red-500/70" : "border-white/5 focus:border-primary/50"}`}
                            />
                            {fieldErrors.phone && <p className="mt-1.5 text-[11px] text-red-400 font-semibold flex items-center gap-1"><AlertTriangle size={11} /> {fieldErrors.phone}</p>}
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Date of Birth</label>
                            <input
                                type="date"
                                value={formData.dateOfBirth}
                                onChange={(e) => setFormData((p) => ({ ...p, dateOfBirth: e.target.value }))}
                                className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none transition-colors focus:border-primary/50 cursor-pointer"
                            />
                            {formData.dateOfBirth && (
                                <p className="mt-1.5 text-[10px] text-text-main/30 font-bold uppercase tracking-widest">
                                    Age: {new Date().getFullYear() - new Date(formData.dateOfBirth).getFullYear()} years old
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Sex</label>
                            <select
                                value={formData.sex}
                                onChange={(e) => setFormData((p) => ({ ...p, sex: e.target.value }))}
                                className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none transition-colors focus:border-primary/50 appearance-none cursor-pointer"
                                style={{ colorScheme: "dark" }}
                            >
                                <option value="">Select Sex</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Professional Bio */}
                <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md">
                    <div className="flex items-center gap-3 mb-6">
                        <FileText size={20} className="text-primary" strokeWidth={2.5} />
                        <h3 className="text-[15px] font-black text-white tracking-widest uppercase">PROFESSIONAL BIO</h3>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">INTRODUCTION</label>
                        <div className="relative">
                            <textarea
                                value={formData.bio}
                                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                maxLength={500}
                                placeholder="Write about your coaching philosophy and track record..."
                                className="w-full h-32 bg-[#12141A] border border-white/5 rounded-2xl p-5 text-white text-sm outline-none focus:border-primary/50 resize-none transition-colors placeholder:text-text-main/30"
                            />
                            <div className="absolute bottom-4 right-5 text-[10px] font-medium text-text-main/40 uppercase tracking-wider italic">
                                {formData.bio.length} / 500 characters
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2-Column Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Specialization */}
                    <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                            <Crosshair size={20} className="text-primary" strokeWidth={2.5} />
                            <h3 className="text-[15px] font-black text-white tracking-widest uppercase">SPECIALIZATION</h3>
                        </div>

                        <div className="flex-1">
                            <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">CORE DISCIPLINES</label>
                            <div className="flex flex-wrap gap-2.5">
                                {sportsLoading
                                    ? Array.from({ length: 10 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="px-5 py-2.5 rounded-full bg-white/10 animate-pulse w-20 h-8"
                                        />
                                    ))
                                    : sportsList.map((sport) => {
                                        const selected = formData.sports.includes(sport.slug);
                                        return (
                                            <button
                                                key={sport.id}
                                                type="button"
                                                onClick={() => {
                                                    setFormData((p) => ({
                                                        ...p,
                                                        sports: selected
                                                            ? p.sports.filter((s) => s !== sport.slug)
                                                            : [...p.sports, sport.slug],
                                                    }));
                                                }}
                                                className={`
                                                    px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all duration-200 border
                                                    ${selected
                                                        ? "bg-primary/10 border-primary/50 text-primary shadow-[0_0_12px_rgba(69,208,255,0.12)]"
                                                        : "bg-transparent border-white/10 text-text-main/50 hover:border-white/30 hover:text-white"
                                                    }
                                                `}
                                            >
                                                {sport.name}
                                            </button>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    </div>

                    {/* Experience */}
                    <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                            <Briefcase size={20} className="text-primary" strokeWidth={2.5} />
                            <h3 className="text-[15px] font-black text-white tracking-widest uppercase">EXPERIENCE</h3>
                        </div>

                        <div className="space-y-6 flex-1">
                            <div>
                                <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">YEARS IN COACHING</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="60"
                                    value={formData.yearsExperience}
                                    onChange={(e) => setFormData({ ...formData, yearsExperience: String(Math.max(0, parseInt(e.target.value) || 0)) })}
                                    placeholder="e.g. 8"
                                    className="w-full bg-[#12141A] border border-white/5 mx-0 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-text-main/30"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">PREVIOUS FACILITY</label>
                                <input
                                    type="text"
                                    value={formData.previousFacility}
                                    onChange={(e) => setFormData({ ...formData, previousFacility: e.target.value })}
                                    placeholder="Elite Performance Academy"
                                    className="w-full bg-[#12141A] border border-white/5 mx-0 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-text-main/30"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Certifications */}
                    <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                            <Award size={20} className="text-primary" strokeWidth={2.5} />
                            <h3 className="text-[15px] font-black text-white tracking-widest uppercase">CERTIFICATIONS DETAILS</h3>
                        </div>

                        <div className="flex-1">
                            <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">LIST YOUR CREDENTIALS</label>
                            <textarea
                                value={formData.certifications}
                                onChange={(e) => setFormData({ ...formData, certifications: e.target.value })}
                                placeholder="E.g. NASM Certified Personal Trainer, ISSA Nutritionist..."
                                className="w-full h-32 bg-[#12141A] border border-white/5 rounded-2xl p-5 text-white text-sm outline-none focus:border-primary/50 resize-none transition-colors placeholder:text-text-main/30"
                            />
                        </div>
                    </div>

                    {/* Location & Matching */}
                    <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md md:col-span-2">
                        <div className="flex items-center gap-3 mb-6">
                            <MapPin size={20} className="text-primary" strokeWidth={2.5} />
                            <h3 className="text-[15px] font-black text-white tracking-widest uppercase">LOCATION & MATCHING</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">City</label>
                                <LocationAutocomplete
                                    value={formData.city ? { city: formData.city, state: formData.state || "", country: "", lat: null, lng: null } : null}
                                    onChange={(loc: LocationValue) => {
                                        if (loc) {
                                            const newZip = loc.zipCode || formData.zipCode;
                                            const newCountry = loc.country ? detectCountry(newZip) : detectCountry(formData.zipCode);
                                            const prevCountry = detectCountry(formData.zipCode);
                                            // Auto-switch radius km/mi when country changes
                                            if (loc.country && newCountry !== prevCountry) {
                                                const currentVal = parseInt(displayRadius) || 20;
                                                if (newCountry === "CA") {
                                                    setDisplayRadius(String(Math.round(miToKm(currentVal))));
                                                } else if (prevCountry === "CA") {
                                                    setDisplayRadius(String(Math.round(kmToMi(currentVal))));
                                                }
                                            }
                                            setFormData((p) => ({
                                                ...p,
                                                city: loc.city,
                                                state: loc.state,
                                                country: loc.country || p.country,
                                                ...(loc.zipCode ? { zipCode: loc.zipCode } : {}),
                                            }));
                                        }
                                    }}
                                    placeholder="Start typing a city..."
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">ZIP / Postal Code</label>
                                <input
                                    type="text"
                                    value={formData.zipCode}
                                    onChange={(e) => {
                                        const zip = e.target.value;
                                        const newCountry = detectCountry(zip);
                                        const prevCountry = detectCountry(formData.zipCode);
                                        if (newCountry !== prevCountry) {
                                            const currentVal = parseInt(displayRadius) || 20;
                                            if (newCountry === "CA") {
                                                setDisplayRadius(String(Math.round(miToKm(currentVal))));
                                            } else if (prevCountry === "CA") {
                                                setDisplayRadius(String(Math.round(kmToMi(currentVal))));
                                            }
                                        }
                                        setFormData((p) => ({ ...p, zipCode: zip }));
                                        setFieldErrors((p) => { const n = { ...p }; delete n.zipCode; return n; });
                                    }}
                                    placeholder="e.g. 90210 or K0L 1B0"
                                    className={`w-full bg-[#12141A] border rounded-2xl px-5 py-3.5 text-white text-sm outline-none transition-colors ${
                                        (() => {
                                            if (!formData.zipCode.trim()) return false;
                                            const zc = detectCountry(formData.zipCode);
                                            if (zc === "OTHER") return true;
                                            return formData.country && formData.country !== zc;
                                        })()
                                            ? "border-red-500/50 focus:border-red-500"
                                            : "border-white/5 focus:border-primary/50"
                                    }`}
                                />
                                {formData.zipCode.trim() && (() => {
                                    const zipC = detectCountry(formData.zipCode);
                                    if (zipC === "OTHER") return <p className="text-[11px] text-red-400 font-bold mt-2">Enter a valid US ZIP (e.g. 90210) or Canadian postal code (e.g. K0L 1B0)</p>;
                                    if (formData.country && formData.country !== zipC) {
                                        const cn = formData.country === "CA" ? "Canada" : formData.country === "US" ? "the US" : formData.country;
                                        return <p className="text-[11px] text-red-400 font-bold mt-2">Your city is in {cn} — postal code doesn&apos;t match</p>;
                                    }
                                    return null;
                                })()}
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">Travel Radius ({radiusUnit(detectCountry(formData.zipCode)) === "km" ? "Kilometers" : "Miles"})</label>
                                <input
                                    type="number"
                                    value={displayRadius}
                                    onChange={(e) => setDisplayRadius(e.target.value)}
                                    min="1"
                                    max="100"
                                    className="w-full bg-[#12141A] border border-white/5 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Target Skill Levels */}
                    <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md flex flex-col md:col-span-2">
                        <div className="flex items-center gap-3 mb-6">
                            <Crosshair size={20} className="text-primary" strokeWidth={2.5} />
                            <h3 className="text-[15px] font-black text-white tracking-widest uppercase">TARGET ATHLETE SKILL LEVELS</h3>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {["beginner", "intermediate", "advanced", "pro"].map((skill) => {
                                const selected = formData.targetSkillLevels.includes(skill as any);
                                return (
                                    <button
                                        key={skill}
                                        type="button"
                                        onClick={() => {
                                            setFormData((p) => ({
                                                ...p,
                                                targetSkillLevels: selected
                                                    ? p.targetSkillLevels.filter((s) => s !== skill)
                                                    : [...p.targetSkillLevels, skill as any],
                                            }));
                                        }}
                                        className={`px-6 py-3 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-200 border ${
                                            selected
                                                ? "bg-primary/10 border-primary/50 text-primary shadow-[0_0_12px_rgba(69,208,255,0.12)]"
                                                : "bg-[#12141A] border-white/10 text-text-main/50 hover:border-white/30 hover:text-white"
                                        }`}
                                    >
                                        {skill}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Availability */}
                    <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md flex flex-col md:col-span-2">
                        <div className="flex items-center gap-3 mb-6">
                            <Clock size={20} className="text-primary" strokeWidth={2.5} />
                            <h3 className="text-[15px] font-black text-white tracking-widest uppercase">PREFERRED AVAILABILITY</h3>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {[
                                { id: "morning", label: "Morning (6am-12pm)" },
                                { id: "afternoon", label: "Afternoon (12pm-5pm)" },
                                { id: "evening", label: "Evening (5pm-9pm)" },
                            ].map((time) => {
                                const selected = formData.preferredTrainingTimes.includes(time.id as any);
                                return (
                                    <button
                                        key={time.id}
                                        type="button"
                                        onClick={() => {
                                            setFormData((p) => ({
                                                ...p,
                                                preferredTrainingTimes: selected
                                                    ? p.preferredTrainingTimes.filter((t) => t !== time.id)
                                                    : [...p.preferredTrainingTimes, time.id as any],
                                            }));
                                        }}
                                        className={`px-6 py-3 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-200 border ${
                                            selected
                                                ? "bg-primary/10 border-primary/50 text-primary shadow-[0_0_12px_rgba(69,208,255,0.12)]"
                                                : "bg-[#12141A] border-white/10 text-text-main/50 hover:border-white/30 hover:text-white"
                                        }`}
                                    >
                                        {time.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Pricing Plans */}
                    <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md">
                        <div className="flex items-center gap-3 mb-6">
                            <DollarSign size={20} className="text-primary" strokeWidth={2.5} />
                            <h3 className="text-[15px] font-black text-white tracking-widest uppercase">PRICING PLANS</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-5 h-36">
                            <div>
                                <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">HOURLY RATE ($)</label>
                                <div className="relative">
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-text-main/40 font-bold">$</span>
                                    <input
                                        type="number"
                                        value={formData.hourlyRate}
                                        onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                                        className="w-full bg-[#12141A] border border-white/5 rounded-2xl pl-10 pr-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-text-main/50 uppercase tracking-[0.15em] mb-4">PACKAGE 10X ($)</label>
                                <div className="relative">
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-text-main/40 font-bold">$</span>
                                    <input
                                        type="number"
                                        value={formData.packageRate}
                                        onChange={(e) => setFormData({ ...formData, packageRate: e.target.value })}
                                        className="w-full bg-[#12141A] border border-white/5 rounded-2xl pl-10 pr-5 py-3.5 text-white text-sm outline-none focus:border-primary/50 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Verification Documents */}
                    <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md md:col-span-2">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <ShieldCheck size={20} className="text-primary" strokeWidth={2.5} />
                                <div>
                                    <h3 className="text-[15px] font-black text-white tracking-widest uppercase">VERIFICATION DOCUMENTS</h3>
                                    <p className="text-[11px] text-text-main/40 font-medium mt-0.5">Upload certifications or ID (PDF only). Reviewed by admin.</p>
                                </div>
                            </div>
                            <div>
                                <input
                                    ref={docInputRef}
                                    type="file"
                                    accept="application/pdf"
                                    className="hidden"
                                    onChange={handleUploadDocument}
                                />
                                <button
                                    type="button"
                                    onClick={() => docInputRef.current?.click()}
                                    disabled={uploadingDoc}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-wider hover:bg-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {uploadingDoc ? (
                                        <><div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Uploading...</>
                                    ) : (
                                        <><Upload size={14} /> Upload PDF</>
                                    )}
                                </button>
                            </div>
                        </div>

                        {verificationDocs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 border border-dashed border-white/10 rounded-xl text-center">
                                <FileUp size={28} className="text-text-main/20 mb-3" />
                                <p className="text-text-main/40 text-sm font-medium">No documents uploaded yet</p>
                                <p className="text-text-main/25 text-xs mt-1">Certificates, coaching licenses, or photo ID (PDF only, max 10 MB)</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {verificationDocs.map((docUrl, idx) => {
                                    const fileName = docUrl.split("/").pop()?.split("?")[0] || `Document ${idx + 1}`;
                                    return (
                                        <div key={docUrl} className="flex items-center justify-between p-3 bg-[#12141A] border border-white/5 rounded-xl group">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                                                    <FileText size={14} className="text-red-400" />
                                                </div>
                                                <span className="text-text-main/70 text-xs font-medium truncate max-w-50">
                                                    Document {idx + 1}.pdf
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <a
                                                    href={docUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-text-main/60 text-[10px] font-black uppercase tracking-wider hover:bg-white/10 hover:text-white transition-all"
                                                >
                                                    <ExternalLink size={11} /> View
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveDocument(docUrl)}
                                                    className="p-1.5 rounded-lg text-text-main/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                                    title="Remove document"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Session Lengths */}
                    <div className="bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 lg:p-8 shadow-md md:col-span-2">
                        <div className="mb-8">
                            <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-1">Session Lengths Offered</h3>
                            <p className="text-zinc-400 text-xs mb-4">Select which session durations you offer</p>
                            <div className="flex flex-wrap gap-3">
                                {[30, 45, 60, 90, 120].map(mins => (
                                    <button
                                        key={mins}
                                        type="button"
                                        onClick={() => {
                                            setSessionLengths(prev =>
                                                prev.includes(mins) ? prev.filter(l => l !== mins) : [...prev, mins]
                                            )
                                        }}
                                        className={`px-5 py-3 rounded-xl text-sm font-bold border transition-all ${
                                            sessionLengths.includes(mins)
                                                ? 'bg-white text-black border-white'
                                                : 'bg-white/4 text-white/60 border-white/10 hover:border-white/30'
                                        }`}
                                    >
                                        {mins < 60 ? `${mins} min` : mins === 60 ? '1 hr' : `${mins / 60} hr`}
                                    </button>
                                ))}
                                {/* Show any custom durations not in presets */}
                                {sessionLengths.filter(m => ![30, 45, 60, 90, 120].includes(m)).map(mins => (
                                    <button
                                        key={mins}
                                        type="button"
                                        onClick={() => setSessionLengths(prev => prev.filter(l => l !== mins))}
                                        className="px-5 py-3 rounded-xl text-sm font-bold border transition-all bg-white text-black border-white"
                                    >
                                        {mins >= 60 ? `${mins / 60} hr` : `${mins} min`}
                                        <X size={12} className="inline ml-1.5 -mt-0.5" />
                                    </button>
                                ))}
                            </div>

                            {/* Custom duration input */}
                            <div className="mt-4 flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max="600"
                                        placeholder="Custom (min)"
                                        value={customDuration}
                                        onChange={(e) => setCustomDuration(e.target.value)}
                                        className="w-36 bg-[#12141A] border border-white/5 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-text-main/30"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const val = parseInt(customDuration);
                                            if (val > 0 && !sessionLengths.includes(val)) {
                                                setSessionLengths(prev => [...prev, val]);
                                            }
                                            setCustomDuration("");
                                        }}
                                        disabled={!customDuration || parseInt(customDuration) <= 0}
                                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-wider hover:bg-primary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <Plus size={14} /> Add
                                    </button>
                                </div>
                                {/* Camp shortcut buttons */}
                                {!sessionLengths.includes(180) && (
                                    <button
                                        type="button"
                                        onClick={() => setSessionLengths(prev => prev.includes(180) ? prev : [...prev, 180])}
                                        className="px-4 py-2.5 rounded-xl text-xs font-bold border border-white/10 text-text-main/50 bg-white/4 hover:border-primary/30 hover:text-primary transition-all"
                                    >
                                        + 3-hour camp (180m)
                                    </button>
                                )}
                                {!sessionLengths.includes(240) && (
                                    <button
                                        type="button"
                                        onClick={() => setSessionLengths(prev => prev.includes(240) ? prev : [...prev, 240])}
                                        className="px-4 py-2.5 rounded-xl text-xs font-bold border border-white/10 text-text-main/50 bg-white/4 hover:border-primary/30 hover:text-primary transition-all"
                                    >
                                        + 4-hour camp (240m)
                                    </button>
                                )}
                            </div>

                            {sessionLengths.length === 0 && (
                                <p className="text-red-400 text-xs mt-2">Please select at least one session length</p>
                            )}
                        </div>

                        {/* Multi-Day Camp Offerings (Change 1) */}
                        <div className="mb-8 border-t border-white/5 pt-6">
                            <button
                                type="button"
                                onClick={() => setShowCampSection(prev => !prev)}
                                className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-widest mb-1 hover:text-primary transition-colors"
                            >
                                {showCampSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                Multi-Day Camp Offerings
                                <span className="text-text-main/40 font-medium text-[10px] normal-case tracking-normal ml-1">(optional)</span>
                            </button>

                            {showCampSection && (
                                <div className="mt-4 space-y-3">
                                    {campOfferings.length === 0 && !showCampForm && (
                                        <p className="text-text-main/40 text-xs">No camps added yet. Add a multi-day camp offering below.</p>
                                    )}

                                    {/* Existing camps list */}
                                    {campOfferings.map((camp, idx) => {
                                        const spotsLeft = camp.spotsRemaining ?? camp.maxSpots;
                                        const spotsPercent = camp.maxSpots > 0 ? (spotsLeft / camp.maxSpots) * 100 : 100;
                                        const isFull = spotsLeft <= 0;
                                        // Format time to 12h
                                        const to12h = (t: string) => {
                                            if (!t) return "";
                                            const [h, m] = t.split(":").map(Number);
                                            const ampm = h >= 12 ? "PM" : "AM";
                                            return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
                                        };
                                        // Auto-calculate end time from start + hoursPerDay
                                        const calcEndTime = (st: string) => {
                                            if (!st || !camp.hoursPerDay) return "";
                                            const [sh, sm] = st.split(":").map(Number);
                                            const total = sh * 60 + sm + camp.hoursPerDay * 60;
                                            const eH = Math.floor(total / 60) % 24;
                                            const eM = Math.round(total % 60);
                                            return `${String(eH).padStart(2, "0")}:${String(eM).padStart(2, "0")}`;
                                        };
                                        // Format dates
                                        const formatDate = (d: string) => {
                                            const dt = new Date(d + "T00:00:00");
                                            return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                                        };
                                        const schedule = camp.schedule && camp.schedule.length > 0 ? camp.schedule : null;

                                        return (
                                            <div key={idx} className={`relative rounded-2xl border overflow-hidden transition-all ${isFull ? "border-red-500/20 bg-red-500/[0.02]" : "border-white/5 bg-[#12141A]"}`}>
                                                {/* Top accent bar */}
                                                <div className={`h-1 w-full ${isFull ? "bg-red-500/30" : "bg-primary/20"}`} />

                                                <div className="p-5">
                                                    {/* Header row */}
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div>
                                                            <h4 className="text-white font-black text-[15px] tracking-wide">{camp.name}</h4>
                                                            <p className="text-primary font-black text-lg mt-0.5">${camp.totalPrice.toLocaleString()}</p>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <button type="button" onClick={() => handleEditCamp(idx)} className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-text-main/40 flex items-center justify-center hover:text-primary hover:bg-primary/10 hover:border-primary/20 transition-all">
                                                                <Pencil size={13} />
                                                            </button>
                                                            <button type="button" onClick={() => handleRemoveCamp(idx)} className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-text-main/30 flex items-center justify-center hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all">
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Info grid */}
                                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                                        <div className="bg-white/[0.03] rounded-xl px-3 py-2.5 border border-white/[0.04]">
                                                            <p className="text-[9px] font-bold text-text-main/30 uppercase tracking-widest mb-1">Duration</p>
                                                            <p className="text-white text-xs font-bold">{camp.hoursPerDay} hrs/day &times; {camp.days} days</p>
                                                        </div>
                                                        {camp.location && (
                                                            <div className="bg-white/[0.03] rounded-xl px-3 py-2.5 border border-white/[0.04]">
                                                                <p className="text-[9px] font-bold text-text-main/30 uppercase tracking-widest mb-1">Location</p>
                                                                <p className="text-white text-xs font-bold flex items-center gap-1 truncate">
                                                                    <MapPin size={10} className="text-primary/50 shrink-0" />
                                                                    {camp.location}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Schedule (individual days) */}
                                                    {schedule && schedule.length > 0 && (
                                                        <div className="mb-4">
                                                            <p className="text-[9px] font-bold text-text-main/30 uppercase tracking-widest mb-2">Schedule</p>
                                                            <div className="space-y-1.5">
                                                                {schedule.map((s, si) => (
                                                                    <div key={si} className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-1.5 border border-white/[0.04]">
                                                                        <span className="text-white text-xs font-bold">{formatDate(s.date)}</span>
                                                                        <span className="text-text-main/30">|</span>
                                                                        <span className="text-white text-xs font-bold flex items-center gap-1">
                                                                            <Clock size={10} className="text-primary/50" />
                                                                            {to12h(s.startTime)} – {to12h(calcEndTime(s.startTime))}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Spots progress bar */}
                                                    {camp.maxSpots > 0 && (
                                                        <div>
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <span className="text-[10px] font-bold text-text-main/40 uppercase tracking-widest">Spots</span>
                                                                <span className={`text-[11px] font-black ${isFull ? "text-red-400" : spotsPercent < 30 ? "text-amber-400" : "text-emerald-400"}`}>
                                                                    {isFull ? "SOLD OUT" : `${spotsLeft}/${camp.maxSpots} available`}
                                                                </span>
                                                            </div>
                                                            <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all ${isFull ? "bg-red-500/50" : spotsPercent < 30 ? "bg-amber-500" : "bg-emerald-500"}`}
                                                                    style={{ width: `${Math.max(2, spotsPercent)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Inline camp form */}
                                    {showCampForm && (
                                        <div className="p-4 bg-[#12141A] border border-primary/20 rounded-xl space-y-3">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-text-main/50 uppercase tracking-wider mb-1.5">Camp Name</label>
                                                    <input
                                                        value={campForm.name}
                                                        onChange={(e) => setCampForm(p => ({ ...p, name: e.target.value }))}
                                                        placeholder="e.g. Summer Hockey Intensive"
                                                        className="w-full bg-[#1A1C23] border border-white/5 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-text-main/30"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-text-main/50 uppercase tracking-wider mb-1.5">Total Price ($)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={campForm.totalPrice}
                                                        onChange={(e) => setCampForm(p => ({ ...p, totalPrice: e.target.value }))}
                                                        placeholder="e.g. 500"
                                                        className="w-full bg-[#1A1C23] border border-white/5 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-text-main/30"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-text-main/50 uppercase tracking-wider mb-1.5">Hours Per Day</label>
                                                    <input
                                                        type="number"
                                                        min="0.5"
                                                        step="0.5"
                                                        value={campForm.hoursPerDay}
                                                        onChange={(e) => setCampForm(p => ({ ...p, hoursPerDay: e.target.value }))}
                                                        placeholder="e.g. 4"
                                                        className="w-full bg-[#1A1C23] border border-white/5 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-text-main/30"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-text-main/50 uppercase tracking-wider mb-1.5">Max Spots</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={campForm.maxSpots}
                                                        onChange={(e) => setCampForm(p => ({ ...p, maxSpots: e.target.value }))}
                                                        placeholder="e.g. 20"
                                                        className="w-full bg-[#1A1C23] border border-white/5 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-text-main/30"
                                                    />
                                                </div>
                                                <div className="sm:col-span-2">
                                                    <label className="block text-[10px] font-bold text-text-main/50 uppercase tracking-wider mb-1.5">Location</label>
                                                    <LocationAutocomplete
                                                        value={campForm.location ? { city: campForm.location, state: "", country: "", lat: null, lng: null } : null}
                                                        onChange={(loc: LocationValue) => {
                                                            setCampForm(p => ({ ...p, location: loc ? `${loc.city}${loc.state ? `, ${loc.state}` : ""}` : "" }));
                                                        }}
                                                        placeholder="e.g. XYZ Arena, Toronto"
                                                    />
                                                </div>
                                            </div>

                                            {/* Schedule: individual day + time rows */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="block text-[10px] font-bold text-text-main/50 uppercase tracking-wider">Schedule (Date + Start Time per day)</label>
                                                    <span className="text-[10px] text-text-main/30 font-medium">{campSchedule.filter(s => s.date && s.startTime).length} day(s)</span>
                                                </div>
                                                <div className="space-y-2">
                                                    {campSchedule.map((entry, si) => (
                                                        <div key={si} className="flex items-center gap-2">
                                                            <input
                                                                type="date"
                                                                value={entry.date}
                                                                min={new Date().toISOString().split("T")[0]}
                                                                onChange={(e) => {
                                                                    const updated = [...campSchedule];
                                                                    updated[si] = { ...updated[si], date: e.target.value };
                                                                    setCampSchedule(updated);
                                                                }}
                                                                className="flex-1 bg-[#1A1C23] border border-white/5 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-primary/50 transition-colors"
                                                            />
                                                            <input
                                                                type="time"
                                                                value={entry.startTime}
                                                                onChange={(e) => {
                                                                    const updated = [...campSchedule];
                                                                    updated[si] = { ...updated[si], startTime: e.target.value };
                                                                    setCampSchedule(updated);
                                                                }}
                                                                className="w-[130px] bg-[#1A1C23] border border-white/5 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-primary/50 transition-colors"
                                                            />
                                                            {/* End time auto display */}
                                                            <div className="w-[100px] text-[11px] text-text-main/40 font-medium text-center">
                                                                {entry.startTime && campForm.hoursPerDay ? (() => {
                                                                    const [h, m] = entry.startTime.split(":").map(Number);
                                                                    const totalMins = h * 60 + m + parseFloat(campForm.hoursPerDay) * 60;
                                                                    const endH = Math.floor(totalMins / 60) % 24;
                                                                    const endM = Math.round(totalMins % 60);
                                                                    const ampm = endH >= 12 ? "PM" : "AM";
                                                                    const h12 = endH % 12 || 12;
                                                                    return `ends ${h12}:${String(endM).padStart(2, "0")} ${ampm}`;
                                                                })() : ""}
                                                            </div>
                                                            {campSchedule.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setCampSchedule(prev => prev.filter((_, i) => i !== si))}
                                                                    className="w-7 h-7 rounded-lg bg-white/5 border border-white/5 text-text-main/30 flex items-center justify-center hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setCampSchedule(prev => [...prev, { date: "", startTime: "" }])}
                                                    className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg bg-white/4 border border-white/10 text-text-main/50 text-[11px] font-bold hover:border-primary/30 hover:text-primary transition-all"
                                                >
                                                    <Plus size={12} /> Add Day
                                                </button>
                                            </div>

                                            <div className="flex items-center gap-2 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={handleAddCamp}
                                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-wider hover:bg-primary/20 transition-all"
                                                >
                                                    <CheckCircle size={14} /> {editingCampIndex !== null ? "Update Camp" : "Save Camp"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setShowCampForm(false); setEditingCampIndex(null); setCampForm({ name: "", hoursPerDay: "", totalPrice: "", location: "", maxSpots: "" }); setCampSchedule([{ date: "", startTime: "" }]); }}
                                                    className="px-4 py-2 rounded-xl text-text-main/50 text-xs font-bold hover:text-white transition-all"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {!showCampForm && (
                                        <button
                                            type="button"
                                            onClick={() => { setShowCampForm(true); setEditingCampIndex(null); setCampForm({ name: "", hoursPerDay: "", totalPrice: "", location: "", maxSpots: "" }); setCampSchedule([{ date: "", startTime: "" }]); }}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/4 border border-white/10 text-text-main/60 text-xs font-bold hover:border-primary/30 hover:text-primary transition-all"
                                        >
                                            <Plus size={14} /> Add Camp
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Training Locations */}
                        <div className="mb-8">
                            <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-1">Training Locations</h3>
                            <p className="text-zinc-400 text-xs mb-4">Where do you train? (select all that apply)</p>
                            <div className="flex flex-wrap gap-3">
                                {['Rink', 'Field', 'Gym', 'Indoor Facility', 'Outdoor Court', 'Pool', 'Track', 'Home Visits', 'Virtual/Online'].map(loc => (
                                    <button
                                        key={loc}
                                        type="button"
                                        onClick={() => {
                                            setTrainingLocations(prev =>
                                                prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]
                                            )
                                        }}
                                        className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                                            trainingLocations.includes(loc)
                                                ? 'bg-white text-black border-white'
                                                : 'bg-white/4 text-white/60 border-white/10 hover:border-white/30'
                                        }`}
                                    >
                                        {loc}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stripe Payout Status */}
            <StripeConnectStatus userId={user?.id} />

            {/* Delete Account */}
            <div className="bg-[#1A1C23] border border-red-500/10 rounded-[20px] p-6 lg:p-8 shadow-md">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-black text-red-400 mb-1">Delete Account</h3>
                        <p className="text-text-main/50 text-sm">Permanently delete your account and all associated data.</p>
                    </div>
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-5 py-2.5 rounded-xl border border-red-500/20 text-red-500/70 font-bold text-sm hover:bg-red-500/10 hover:text-red-400 transition-all shrink-0"
                    >
                        Delete Account
                    </button>
                </div>
            </div>

            {/* Delete Account Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6">
                    <div className="bg-[#1A1C23] border border-white/10 rounded-2xl p-8 w-full max-w-[400px] text-center">
                        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
                            <ShieldAlert className="text-red-400 w-7 h-7" strokeWidth={2} />
                        </div>
                        <h3 className="text-xl font-black text-white mb-2">Delete Account?</h3>
                        <p className="text-text-main/50 text-sm mb-7 leading-relaxed">
                            This action cannot be undone. Your account and all associated data will be permanently deleted.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deleting}
                                className="flex-1 px-5 py-3 rounded-xl border border-white/[0.08] text-text-main/70 font-bold text-sm hover:bg-white/[0.04] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                disabled={deleting}
                                className="flex-1 px-5 py-3 rounded-xl bg-red-500 text-white font-black text-sm hover:bg-red-400 transition-colors flex items-center justify-center"
                            >
                                {deleting ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Popup Modal */}
            {popup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1A1C23] border border-white/10 rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center">
                            {popup.type === "success" ? (
                                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4 text-primary">
                                    <CheckCircle size={28} strokeWidth={2.5} />
                                </div>
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4 text-red-500">
                                    <AlertTriangle size={28} strokeWidth={2.5} />
                                </div>
                            )}
                            <h3 className={`text-xl font-black font-display uppercase tracking-wider mb-2 ${popup.type === "success" ? "text-primary" : "text-red-500"}`}>
                                {popup.type === "success" ? "Success!" : "Error"}
                            </h3>
                            <p className="text-text-main/80 text-sm font-medium mb-6">
                                {popup.message}
                            </p>
                            <button
                                onClick={() => setPopup(null)}
                                className={`w-full py-3 rounded-full font-black text-sm uppercase tracking-wider transition-all ${
                                    popup.type === "success" 
                                    ? "bg-primary text-bg hover:shadow-[0_0_15px_rgba(69,208,255,0.3)]" 
                                    : "bg-red-500 text-white hover:bg-red-600"
                                }`}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Inline component: Stripe Connect status card for trainer setup page
function StripeConnectStatus({ userId }: { userId?: string }) {
    const [status, setStatus] = useState<{ hasAccount: boolean; onboardingComplete: boolean; payoutsEnabled: boolean } | null>(null);

    useEffect(() => {
        if (!userId) return;
        fetch(`/api/stripe/connect?userId=${userId}`)
            .then(r => r.json())
            .then(setStatus)
            .catch(() => {});
    }, [userId]);

    if (!status) return null;

    const isConnected = status.hasAccount && status.onboardingComplete && status.payoutsEnabled;
    const isPartial = status.hasAccount && !status.onboardingComplete;

    return (
        <div className="mt-6 bg-[#1A1C23] border border-white/5 rounded-[20px] p-6 shadow-md">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isConnected ? "bg-emerald-500/15 text-emerald-400" : isPartial ? "bg-amber-500/15 text-amber-400" : "bg-white/5 text-text-main/40"
                    }`}>
                        <DollarSign size={20} />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-sm">
                            {isConnected ? "Bank Account Connected" : isPartial ? "Stripe Setup Incomplete" : "Bank Account Not Connected"}
                        </h3>
                        <p className="text-text-main/50 text-xs">
                            {isConnected
                                ? "You're all set to receive payouts."
                                : "Connect your bank to receive payouts from sessions."}
                        </p>
                    </div>
                </div>
                {!isConnected && (
                    <Link
                        href="/dashboard/payments"
                        className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-wider hover:bg-primary/20 transition-all flex items-center gap-1.5"
                    >
                        {isPartial ? "Complete Setup" : "Connect"}
                        <ExternalLink size={12} />
                    </Link>
                )}
                {isConnected && (
                    <CheckCircle size={22} className="text-emerald-400" />
                )}
            </div>
        </div>
    );
}
