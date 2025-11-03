import {
  Sprout,
  Users,
  BarChart3,
  Shield,
  Leaf,
  MapPin,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Link } from "react-router-dom";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/30 via-background to-blue-50/20">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-gradient-to-r from-green-600/10 to-blue-600/10"
          style={{
            backgroundImage: `url(https://images.unsplash.com/photo-1622123651884-e3d30eebfbff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXJtJTIwd29ya2VycyUyMGNvbGxhYm9yYXRpb258ZW58MXx8fHwxNzU5MDc3NjgzfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.05,
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-xl">
                <Sprout className="h-12 w-12 text-white" />
              </div>
            </div>

            <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent">
              FarmConnect Pro
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              The complete multi-tenant platform for modern farm management.
              Connect farmers, workers, and agricultural teams in one powerful
              system.
            </p>

            {/* 🔹 Login Link Button */}
            <div className="mb-10">
              <Link
                to="/login"
                className="inline-flex items-center justify-center px-6 py-3 text-white bg-green-600 hover:bg-green-700 rounded-lg text-lg font-medium shadow-lg transition-all duration-200"
              >
                Login to Dashboard
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-3 mb-8">
              <Badge className="bg-green-100 text-green-800 px-3 py-1">
                Multi-Tenant
              </Badge>
              <Badge className="bg-blue-100 text-blue-800 px-3 py-1">
                Team Collaboration
              </Badge>
              <Badge className="bg-orange-100 text-orange-800 px-3 py-1">
                Secure Authentication
              </Badge>
            </div>
          </div>

          {/* Target Audience Cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* For Farmers */}
            <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-green-100/50 hover:shadow-lg transition-all duration-300">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto p-3 bg-green-500 rounded-xl shadow-lg mb-4 w-fit">
                  <Leaf className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl text-green-900">
                  For Farm Owners
                </CardTitle>
                <p className="text-green-700">
                  Manage your agricultural operations and team
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm">
                      Create and manage farm profiles
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm">
                      Invite and manage team members
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm">
                      Track farm operations and analytics
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm">
                      Manage crop types and farm details
                    </span>
                  </div>
                </div>
                <Button
                  // onClick={}
                  className="w-full bg-green-600 hover:bg-green-700 text-white mt-6"
                  size="lg"
                >
                  <Link
                    to={"/register-farmer"}
                    className="w-full flex flex-row justify-center items-center"
                  >
                    Create New Farm
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* For Workers */}
            <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 hover:shadow-lg transition-all duration-300">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto p-3 bg-blue-500 rounded-xl shadow-lg mb-4 w-fit">
                  <Users className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl text-blue-900">
                  For Team Members
                </CardTitle>
                <p className="text-blue-700">
                  Join existing farms and collaborate
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <span className="text-sm">
                      Join existing farm operations
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <span className="text-sm">
                      Manage your role and responsibilities
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <span className="text-sm">
                      Collaborate with team members
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <span className="text-sm">
                      Access farm information and tasks
                    </span>
                  </div>
                </div>
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-6"
                  size="lg"
                >
                  <Link
                    to={"/register-worker"}
                    className="w-full flex flex-row justify-center items-center"
                  >
                    Join Existing Farm
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Platform Features</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage modern agricultural operations
              efficiently
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-orange-200 bg-orange-50/50">
              <CardContent className="p-6 text-center">
                <div className="mx-auto p-3 bg-orange-500 rounded-xl shadow-lg mb-4 w-fit">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold mb-2 text-orange-900">
                  Secure Multi-Tenant
                </h3>
                <p className="text-sm text-orange-700">
                  Each farm operates independently with secure data isolation
                  and role-based access control.
                </p>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50/50">
              <CardContent className="p-6 text-center">
                <div className="mx-auto p-3 bg-purple-500 rounded-xl shadow-lg mb-4 w-fit">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold mb-2 text-purple-900">
                  Analytics & Insights
                </h3>
                <p className="text-sm text-purple-700">
                  Track farm performance, crop yields, and team productivity
                  with detailed analytics.
                </p>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="p-6 text-center">
                <div className="mx-auto p-3 bg-emerald-500 rounded-xl shadow-lg mb-4 w-fit">
                  <MapPin className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold mb-2 text-emerald-900">
                  Location Management
                </h3>
                <p className="text-sm text-emerald-700">
                  Manage multiple farm locations with detailed geographic and
                  operational data.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
