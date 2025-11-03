import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Separator } from "../../components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import {
  Sprout,
  Users,
  MapPin,
  BarChart3,
  Settings,
  LogOut,
  Leaf,
  TrendingUp,
  Calendar,
  CheckCircle,
  Clock,
  UserPlus,
  Edit,
  Eye,
} from "lucide-react";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  position: string;
  tenant: {
    id: string;
    name?: string;
    farmSize?: number;
    cropTypes?: string[];
    address?: string;
    country?: string;
  };
}

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const user: User = {
  id: "u12345",
  email: "farmer.john@example.com",
  firstName: "John",
  lastName: "Doe",
  role: "Farmer",
  position: "Field Manager",
  tenant: {
    id: "t67890",
    name: "Green Valley Farms",
    farmSize: 120,
    cropTypes: ["Maize", "Cassava", "Soybeans"],
    address: "123 Farm Road, Ibadan",
    country: "Nigeria",
  },
};

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const isFarmOwner = user.tenant.name !== undefined;

  // Mock data for demonstration
  const teamMembers = [
    {
      id: "1",
      name: "Sarah Johnson",
      role: "Field Worker",
      status: "active",
      lastActive: "2 hours ago",
    },
    {
      id: "2",
      name: "Mike Chen",
      role: "Supervisor",
      status: "active",
      lastActive: "30 minutes ago",
    },
    {
      id: "3",
      name: "Emma Wilson",
      role: "Agronomist",
      status: "offline",
      lastActive: "1 day ago",
    },
  ];

  const recentActivities = [
    {
      id: "1",
      action: "Updated crop rotation plan",
      user: "Sarah Johnson",
      time: "2 hours ago",
    },
    {
      id: "2",
      action: "Completed soil analysis",
      user: "Emma Wilson",
      time: "4 hours ago",
    },
    {
      id: "3",
      action: "Reported harvest progress",
      user: "Mike Chen",
      time: "6 hours ago",
    },
  ];

  const farmStats = {
    totalArea: user.tenant.farmSize || 0,
    activeFields: 8,
    cropVarieties: user.tenant.cropTypes?.length || 0,
    teamSize: teamMembers.length + 1,
  };

  const onLogout = () => {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/30 via-background to-blue-50/20">
      {/* Header */}
      <header className="border-b bg-card/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
                <Sprout className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-lg">
                  {user.tenant.name || `Farm #${user.tenant.id}`}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {user.tenant.address || "Multi-tenant Farm Management"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-medium">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {user.position || user.role}
                </p>
              </div>
              <Avatar>
                <AvatarFallback className="bg-green-500 text-white">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <Button variant="outline" size="sm" onClick={onLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="profile">My Profile</TabsTrigger>
            {isFarmOwner && <TabsTrigger value="team">Team</TabsTrigger>}
            {isFarmOwner && (
              <TabsTrigger value="farm">Farm Details</TabsTrigger>
            )}
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500 rounded-lg">
                      <MapPin className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Farm Area</p>
                      <p className="text-xl font-semibold">
                        {farmStats.totalArea} ha
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500 rounded-lg">
                      <Leaf className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Active Fields
                      </p>
                      <p className="text-xl font-semibold">
                        {farmStats.activeFields}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-orange-200 bg-orange-50/50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500 rounded-lg">
                      <BarChart3 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Crop Varieties
                      </p>
                      <p className="text-xl font-semibold">
                        {farmStats.cropVarieties}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500 rounded-lg">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Team Size</p>
                      <p className="text-xl font-semibold">
                        {farmStats.teamSize}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recentActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
                    >
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm">{activity.action}</p>
                        <p className="text-xs text-muted-foreground">
                          by {activity.user} • {activity.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full justify-start" variant="outline">
                    <Calendar className="mr-2 h-4 w-4" />
                    Schedule Farm Activity
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    View Analytics
                  </Button>
                  {isFarmOwner && (
                    <Button className="w-full justify-start" variant="outline">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Invite Team Member
                    </Button>
                  )}
                  <Button className="w-full justify-start" variant="outline">
                    <Edit className="mr-2 h-4 w-4" />
                    Update Profile
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Full Name
                    </p>
                    <p>
                      {user.firstName} {user.lastName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Email
                    </p>
                    <p>{user.email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Role
                    </p>
                    <Badge variant="secondary">{user.role}</Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Position
                    </p>
                    <p>{user.position || "Not specified"}</p>
                  </div>
                </div>
                <Separator />
                <Button>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Profile
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Tab (Farm Owners Only) */}
          {isFarmOwner && (
            <TabsContent value="team" className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">Team Management</h2>
                  <p className="text-muted-foreground">
                    Manage your farm team members
                  </p>
                </div>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Member
                </Button>
              </div>

              <div className="grid gap-4">
                {teamMembers.map((member) => (
                  <Card key={member.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarFallback>
                              {member.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {member.role}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={
                              member.status === "active"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {member.status}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            Last active: {member.lastActive}
                          </p>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          )}

          {/* Farm Details Tab (Farm Owners Only) */}
          {isFarmOwner && (
            <TabsContent value="farm" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Farm Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Farm Name
                      </p>
                      <p>{user.tenant.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Farm Size
                      </p>
                      <p>{user.tenant.farmSize} hectares</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Country
                      </p>
                      <p>{user.tenant.country}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Address
                      </p>
                      <p>{user.tenant.address}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Crop Types
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {user.tenant.cropTypes?.map((crop) => (
                        <Badge key={crop} variant="outline">
                          {crop}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <Button>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Farm Details
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  <Settings className="mr-2 h-4 w-4" />
                  General Settings
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Users className="mr-2 h-4 w-4" />
                  Privacy Settings
                </Button>
                <Separator />
                <Button variant="destructive" className="w-full">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};
export default Dashboard;
