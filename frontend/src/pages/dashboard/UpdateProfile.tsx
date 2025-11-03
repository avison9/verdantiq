import { useState } from "react";
import Spinner from "../../components/Spinner";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { ArrowLeft, MapPin, Leaf, Plus, X, Save, Sprout } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Link } from "react-router-dom";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import { useGetProfileQuery } from "../../redux/apislices/profileApiSlice";
import { useSelector } from "react-redux";
import { RootState } from "../../redux/store";

export default function UpdateProfilePage() {
  const { userInfo } = useSelector((state: RootState) => state.auth);
  const { data, isLoading: loadingProfileData } = useGetProfileQuery(
    userInfo?.id || ""
  );
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState<IUser>({
    email: data?.email || "",
    password: data?.password || "",
    first_name: data?.first_name || "",
    last_name: data?.last_name || "",
    tenant_name: data?.tenant_name || "",
    tenant_profile: {
      country: data?.tenant_profile?.country || "",
      address: data?.tenant_profile?.address || "",
      farm_size: data?.tenant_profile?.farm_size || 0,
      crop_types: data?.tenant_profile?.crop_types || [],
    },
    user_profile: {
      country: data?.user_profile?.country || "",
      address: data?.user_profile?.address || "",
      role: data?.user_profile?.role || "",
      position: data?.user_profile?.position || "",
    },
  });

  const [newCrop, setNewCrop] = useState("");

  // Add crop
  const handleAddCrop = () => {
    if (
      newCrop.trim() &&
      !formData?.tenant_profile?.crop_types?.includes(newCrop.trim())
    ) {
      setFormData(
        (prev) =>
          ({
            ...prev,
            tenant_profile: {
              ...prev?.tenant_profile,
              crop_types: [
                ...(prev.tenant_profile?.crop_types ?? []),
                newCrop.trim(),
              ],
            },
          } as IUser)
      );
      setNewCrop("");
    }
  };

  // Remove crop
  const handleRemoveCrop = (crop: string) => {
    setFormData(
      (prev) =>
        ({
          ...prev,
          tenant_profile: {
            ...prev?.tenant_profile,
            crop_types: prev?.tenant_profile?.crop_types?.filter(
              (c) => c !== crop
            ),
          },
        } as IUser)
    );
  };

  // ✅ Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const userData = {
      email: formData.email,
      password: formData.password,
      first_name: formData.first_name,
      last_name: formData.last_name,
      tenant_name: formData.tenant_name,
      role: formData?.user_profile?.role,
      position: formData?.user_profile?.position,
      tenant_profile: {
        farm_size: formData?.tenant_profile?.farm_size,
        crop_types: formData?.tenant_profile?.crop_types,
        address: formData?.tenant_profile?.address,
        country: formData?.tenant_profile?.country,
      },
      user_profile: {
        country: formData?.user_profile?.country || "",
        address: formData?.user_profile?.address || "",
        role: formData?.user_profile?.role || "",
        position: formData?.user_profile?.position || "",
      },
    };

    console.log("Submitted user:", userData);
  };

  if (!formData)
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner />
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/30 via-background to-blue-50/20 p-6">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" className="mb-6">
          <Link to="/" className="flex flex-row">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>

        <Card className="border-2 shadow-lg border-green-200">
          <CardHeader className="text-center bg-gradient-to-r from-green-50 to-green-100/50">
            <div className="mx-auto p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg mb-4 w-fit">
              <Sprout className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl text-green-900">
              Update Your Profile
            </CardTitle>
            <p className="text-green-700">
              Modify your personal and farm information
            </p>
          </CardHeader>

          <CardContent className="p-8">
            <form className="space-y-8" onSubmit={handleSubmit}>
              {/* Personal Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-blue-500 rounded-md">
                    <MapPin className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-blue-900">
                    Personal Information
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={formData.first_name}
                      onChange={(e) =>
                        setFormData({ ...formData, first_name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={formData.last_name}
                      onChange={(e) =>
                        setFormData({ ...formData, last_name: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Farm Info */}
              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-green-500 rounded-md">
                    <Leaf className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-green-900">
                    Farm Information
                  </h3>
                </div>

                <Label htmlFor="tenantName">Farm/Organization Name</Label>
                <Input
                  id="tenantName"
                  value={formData.tenant_name}
                  onChange={(e) =>
                    setFormData({ ...formData, tenant_name: e.target.value })
                  }
                />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="farmSize">Farm Size</Label>
                    <Input
                      id="farmSize"
                      type="number"
                      value={formData.tenant_profile?.farm_size ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          tenant_profile: {
                            ...formData.tenant_profile!,
                            farm_size: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Select
                      value={formData.tenant_profile?.country}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          tenant_profile: {
                            ...formData.tenant_profile!,
                            country: value,
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Nigeria">🇳🇬 Nigeria</SelectItem>
                        <SelectItem value="Ghana">🇬🇭 Ghana</SelectItem>
                        <SelectItem value="Kenya">🇰🇪 Kenya</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">Farm Address</Label>
                  <Textarea
                    id="address"
                    value={formData.tenant_profile?.address ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tenant_profile: {
                          ...formData.tenant_profile!,
                          address: e.target.value,
                        },
                      })
                    }
                  />
                </div>

                <div>
                  <Label>Primary Crops</Label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={newCrop}
                      onChange={(e) => setNewCrop(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        (e.preventDefault(), handleAddCrop())
                      }
                      placeholder="Add crop"
                    />
                    <Button
                      type="button"
                      onClick={handleAddCrop}
                      className="bg-green-600 hover:bg-green-700"
                      size="sm"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {formData.tenant_profile?.crop_types?.map((crop) => (
                      <Badge
                        key={crop}
                        variant="secondary"
                        className="bg-green-100 text-green-800 flex items-center gap-1"
                      >
                        {crop}
                        <button
                          type="button"
                          onClick={() => handleRemoveCrop(crop)}
                          className="hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isLoading ? <Spinner /> : "Update Profile"}
                  <Save className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
