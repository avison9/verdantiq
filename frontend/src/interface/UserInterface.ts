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
