import { useState } from "react";
import { ArrowLeft, Sprout, Plus, X, MapPin, Leaf } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import { Link } from "react-router-dom";
import { useSignupMutation } from "../../redux/apislices/authApiSlice";
import { toast } from "react-toastify";
import Spinner from "../../components/Spinner";

const FarmerRegistrationForm = () => {
  const [signup, { isLoading }] = useSignupMutation();
  const [formData, setFormData] = useState<IUser>({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    tenant_name: "",
    tenant_profile: {
      country: "",
      address: "",
      farm_size: 0,
      crop_types: [],
    },
    user_profile: {
      country: "",
      address: "",
      role: "",
      position: "",
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
    try {
      const response = await signup(userData);
      console.log("response ===> ", response);
      if (response.data) {
        toast.success("registration successful");
        console.log("response success ===> ", response.data?.message);
        console.log("register response data ===> ", response.data);
      }
      if ("error" in response && response.error) {
        let errorMessage = "An unexpected error occurred";

        // Check if it's a FetchBaseQueryError (API error)
        if (
          "data" in response.error &&
          typeof response.error.data === "object"
        ) {
          const errorData = response.error.data as { message?: string };
          errorMessage = errorData.message || errorMessage;
          console.log("error message at signup ==>> ", errorMessage);
        }

        if ("message" in response.error) {
          errorMessage = response.error.message || errorMessage;
          console.log("error message at signup ==>> ", errorMessage);
        }
      }
    } catch (error) {
      console.log("sign in catch error ==> ", error);
      let errorMessage = "An unexpected error occurred";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/30 via-background to-blue-50/20 p-6">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          // onClick={onBack}
          className="mb-6"
        >
          <Link to={"/"} className="flex flex-row">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>

        <Card className="border-2 shadow-lg border-green-200">
          <CardHeader className="text-center bg-gradient-to-r from-green-50 to-green-100/50">
            <div className="mx-auto p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg mb-4 w-fit">
              <Sprout className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl text-green-900">
              Create Your Farm
            </CardTitle>
            <p className="text-green-700">
              Set up your agricultural organization and become the farm owner
            </p>
          </CardHeader>

          <CardContent className="p-8">
            <form className="space-y-8">
              {/* Personal Information */}
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
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.first_name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          first_name: e.target.value,
                        }))
                      }
                      placeholder="John"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.last_name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          last_name: e.target.value,
                        }))
                      }
                      placeholder="Doe"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder="john.doe@example.com"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    placeholder="Create a secure password"
                    required
                  />
                </div>
              </div>

              {/* Farm Information */}
              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-green-500 rounded-md">
                    <Leaf className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-green-900">
                    Farm Information
                  </h3>
                </div>

                <div>
                  <Label htmlFor="tenantName">Farm/Organization Name *</Label>
                  <Input
                    id="tenantName"
                    value={formData.tenant_name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        tenant_name: e.target.value,
                      }))
                    }
                    placeholder="e.g., GreenFarm Agriculture Ltd."
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This will be your organization's display name
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="farmSize">Total Farm Size *</Label>
                    <div className="relative">
                      <Input
                        id="farm_size"
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={formData?.tenant_profile?.farm_size}
                        onChange={(e) =>
                          setFormData(
                            (prev: IUser) =>
                              ({
                                ...prev,
                                tenant_profile: {
                                  ...prev.tenant_profile,
                                  farm_size: Number(e.target.value),
                                },
                              } as IUser)
                          )
                        }
                        placeholder="10.5"
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        hectares
                      </span>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="country">Country *</Label>
                    <Select
                      value={formData?.tenant_profile?.country}
                      onValueChange={(value: string) =>
                        setFormData(
                          (prev) =>
                            ({
                              ...prev,
                              tenant_profile: {
                                ...prev.tenant_profile,
                                country: value,
                              },
                            } as IUser)
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Nigeria">🇳🇬 Nigeria</SelectItem>
                        <SelectItem value="Ghana">🇬🇭 Ghana</SelectItem>
                        <SelectItem value="Kenya">🇰🇪 Kenya</SelectItem>
                        <SelectItem value="South Africa">
                          🇿🇦 South Africa
                        </SelectItem>
                        <SelectItem value="Uganda">🇺🇬 Uganda</SelectItem>
                        <SelectItem value="Tanzania">🇹🇿 Tanzania</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">Farm Address *</Label>
                  <Textarea
                    id="address"
                    value={formData?.tenant_profile?.address}
                    onChange={(e) =>
                      setFormData(
                        (prev) =>
                          ({
                            ...prev,
                            tenant_profile: {
                              ...prev.tenant_profile,
                              address: e.target.value,
                            },
                          } as IUser)
                      )
                    }
                    placeholder="123 Farm Road, Ogun State, Nigeria"
                    rows={3}
                    required
                  />
                </div>

                <div>
                  <Label>Primary Crop Types</Label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={newCrop}
                      onChange={(e) => setNewCrop(e.target.value)}
                      placeholder="e.g., maize, cassava, yam"
                      onKeyPress={(e) =>
                        e.key === "Enter" &&
                        (e.preventDefault(), handleAddCrop())
                      }
                    />
                    <Button
                      type="button"
                      onClick={handleAddCrop}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[32px]">
                    {formData?.tenant_profile?.crop_types?.map((crop) => (
                      <Badge
                        key={crop}
                        variant="secondary"
                        className="flex items-center gap-1 bg-green-100 text-green-800"
                      >
                        {crop}
                        <button
                          type="button"
                          onClick={() => handleRemoveCrop(crop)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add the main crops you cultivate (optional but recommended)
                  </p>
                </div>
              </div>

              {/* Role Information */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold">Your Role & Position</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="role">Primary Role *</Label>
                    <Select
                      value={formData?.user_profile?.role}
                      onValueChange={(value: string) =>
                        setFormData(
                          (prev) =>
                            ({
                              ...prev,
                              user_profile: {
                                ...prev.user_profile,
                                role: value,
                              },
                            } as IUser)
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Farm Owner</SelectItem>
                        <SelectItem value="manager">Farm Manager</SelectItem>
                        <SelectItem value="director">
                          Operations Director
                        </SelectItem>
                        <SelectItem value="administrator">
                          Administrator
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="position">Job Title/Position</Label>
                    <Input
                      id="position"
                      value={formData?.user_profile?.position}
                      onChange={(e) =>
                        setFormData(
                          (prev) =>
                            ({
                              ...prev,
                              user_profile: {
                                ...prev.user_profile,
                                position: e.target.value,
                              },
                            } as IUser)
                        )
                      }
                      placeholder="e.g., Chief Executive Officer"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  onClick={handleSubmit}
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  {isLoading ? <Spinner /> : "Create Farm & Register"}
                  <Sprout className="ml-2 h-4 w-4" />
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  By creating your farm, you'll become the organization owner
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FarmerRegistrationForm;
