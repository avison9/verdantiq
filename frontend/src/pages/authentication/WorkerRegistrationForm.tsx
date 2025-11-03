import { useState } from "react";
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
  ArrowLeft,
  Users,
  User,
  Briefcase,
  Building,
  Search,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Link } from "react-router-dom";
import { useSignupMutation } from "../../redux/apislices/authApiSlice";
import { toast } from "react-toastify";

const WorkerRegistrationForm = () => {
  const [signup, { isLoading }] = useSignupMutation();
  const [formData, setFormData] = useState<IUser>({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    tenant_id: "",
    user_profile: {
      country: "",
      address: "",
      role: "",
      position: "",
    },
  });

  const [farmFound, setFarmFound] = useState(false);
  const [searchingFarm, setSearchingFarm] = useState(false);

  // Mock farm lookup function
  const handleFarmLookup = async () => {
    if (!formData?.tenant_id?.trim()) return;

    setSearchingFarm(true);
    // Simulate API call
    setTimeout(() => {
      // Mock finding a farm
      setFarmFound(true);
      setFormData((prev) => ({
        ...prev,
        farmName: `GreenFarm Agriculture (ID: ${formData?.tenant_id})`,
      }));
      setSearchingFarm(false);
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Simulate registration
    const userData = {
      email: formData.email,
      first_name: formData.first_name,
      last_name: formData.last_name,
      password: formData.password,
      position: formData.user_profile?.position,
      tenant_id: formData?.tenant_id,
      user_profile: {
        role: formData.user_profile?.role || "",
        country: formData?.user_profile?.country || "",
      },
    };

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-background to-green-50/20 p-6">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          //   onClick={onBack}
          className="mb-6"
        >
          <Link to={"/"} className="flex flex-row">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>

        <Card className="border-2 shadow-lg border-blue-200">
          <CardHeader className="text-center bg-gradient-to-r from-blue-50 to-blue-100/50">
            <div className="mx-auto p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg mb-4 w-fit">
              <Users className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl text-blue-900">
              Join Existing Farm
            </CardTitle>
            <p className="text-blue-700">
              Become a team member of an established agricultural organization
            </p>
          </CardHeader>

          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Personal Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-purple-500 rounded-md">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-purple-900">
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
                      placeholder="Sarah"
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
                      placeholder="Johnson"
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
                    placeholder="sarah.johnson@example.com"
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

                <div>
                  <Label htmlFor="country">Country *</Label>
                  <Select
                    value={formData.user_profile?.country}
                    onValueChange={(value: string) =>
                      setFormData(
                        (prev) =>
                          ({
                            ...prev,
                            user_profile: {
                              ...prev?.user_profile,
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

              {/* Farm Information */}
              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-green-500 rounded-md">
                    <Building className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-green-900">
                    Farm Organization
                  </h3>
                </div>

                <div>
                  <Label htmlFor="tenant_id">Farm ID *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="tenant_id"
                      value={formData?.tenant_id}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          tenant_id: e.target.value,
                        }))
                      }
                      placeholder="Enter the Farm ID provided by your manager"
                      required
                    />
                    <Button
                      type="button"
                      onClick={handleFarmLookup}
                      disabled={searchingFarm || !formData?.tenant_id?.trim()}
                      variant="outline"
                      className="shrink-0"
                    >
                      {searchingFarm ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Contact your farm manager or owner to get the Farm ID
                  </p>

                  {farmFound && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-green-800 font-medium">
                          Farm Found:
                        </span>
                      </div>
                      <p className="text-sm text-green-700 mt-1">
                        {formData.first_name}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Professional Information */}
              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-orange-500 rounded-md">
                    <Briefcase className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-orange-900">
                    Professional Details
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="role">Primary Role *</Label>
                    <Select
                      value={formData.user_profile?.role}
                      onValueChange={(value: string) =>
                        setFormData((prev) => ({ ...prev, role: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="field worker">
                          Field Worker
                        </SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="agronomist">Agronomist</SelectItem>
                        <SelectItem value="veterinarian">
                          Veterinarian
                        </SelectItem>
                        <SelectItem value="equipment operator">
                          Equipment Operator
                        </SelectItem>
                        <SelectItem value="quality controller">
                          Quality Controller
                        </SelectItem>
                        <SelectItem value="logistics coordinator">
                          Logistics Coordinator
                        </SelectItem>
                        <SelectItem value="farm assistant">
                          Farm Assistant
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="position">Job Title/Position</Label>
                    <Input
                      id="position"
                      value={formData.user_profile?.position}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          position: e.target.value,
                        }))
                      }
                      placeholder="e.g., Senior Field Supervisor"
                    />
                  </div>
                </div>

                {/* <div>
                  <Label htmlFor="experience">Years of Experience</Label>
                  <Select
                    value={formData.experience}
                    onValueChange={(value: string) =>
                      setFormData((prev) => ({ ...prev, experience: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select experience level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0-1">Less than 1 year</SelectItem>
                      <SelectItem value="1-3">1-3 years</SelectItem>
                      <SelectItem value="3-5">3-5 years</SelectItem>
                      <SelectItem value="5-10">5-10 years</SelectItem>
                      <SelectItem value="10+">More than 10 years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="specialization">Area of Specialization</Label>
                  <Select
                    value={formData.specialization}
                    onValueChange={(value: string) =>
                      setFormData((prev) => ({
                        ...prev,
                        specialization: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your specialization (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="crop production">
                        Crop Production
                      </SelectItem>
                      <SelectItem value="livestock management">
                        Livestock Management
                      </SelectItem>
                      <SelectItem value="soil management">
                        Soil Management
                      </SelectItem>
                      <SelectItem value="pest control">Pest Control</SelectItem>
                      <SelectItem value="irrigation systems">
                        Irrigation Systems
                      </SelectItem>
                      <SelectItem value="harvesting">
                        Harvesting & Processing
                      </SelectItem>
                      <SelectItem value="farm machinery">
                        Farm Machinery
                      </SelectItem>
                      <SelectItem value="organic farming">
                        Organic Farming
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div> */}
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="lg"
                  disabled={!farmFound}
                >
                  Join Farm Team
                  <Users className="ml-2 h-4 w-4" />
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  You'll need approval from the farm manager to complete
                  registration
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
export default WorkerRegistrationForm;
