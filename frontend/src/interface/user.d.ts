interface TenantProfile {
  country?: string;
  address?: string;
  farm_size?: number;
  crop_types?: string[];
}

interface UserProfile {
  country: string;
  address?: string;
  role: string;
  position?: string;
}

interface IUser {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  tenant_name?: string;
  tenant_id?: string;
  tenant_profile?: TenantProfile;
  user_profile?: UserProfile;
}
