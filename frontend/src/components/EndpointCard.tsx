import { CodeBlock } from './CodeBlock';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader } from './ui/card';
import { Globe, Lock, User, LogOut, UserCheck, Settings } from 'lucide-react';

interface EndpointCardProps {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  title: string;
  description: string;
  code: string;
}

const methodConfig = {
  GET: { 
    color: 'bg-blue-500 text-white hover:bg-blue-600', 
    icon: Globe,
    gradient: 'from-blue-500/10 to-blue-600/5'
  },
  POST: { 
    color: 'bg-green-500 text-white hover:bg-green-600', 
    icon: UserCheck,
    gradient: 'from-green-500/10 to-green-600/5'
  },
  PUT: { 
    color: 'bg-orange-500 text-white hover:bg-orange-600', 
    icon: Settings,
    gradient: 'from-orange-500/10 to-orange-600/5'
  },
  DELETE: { 
    color: 'bg-red-500 text-white hover:bg-red-600', 
    icon: LogOut,
    gradient: 'from-red-500/10 to-red-600/5'
  }
};

const getEndpointIcon = (title: string) => {
  if (title.toLowerCase().includes('login')) return Lock;
  if (title.toLowerCase().includes('logout')) return LogOut;
  if (title.toLowerCase().includes('register')) return UserCheck;
  if (title.toLowerCase().includes('profile')) return User;
  return Globe;
};

export function EndpointCard({ method, endpoint, title, description, code }: EndpointCardProps) {
  const config = methodConfig[method];
  const Icon = getEndpointIcon(title);
  
  return (
    <Card className="overflow-hidden border-2 hover:border-primary/20 transition-all duration-300 hover:shadow-lg">
      <CardHeader className={`bg-gradient-to-r ${config.gradient} border-b`}>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-2">
            <Badge className={`${config.color} px-3 py-1 font-semibold`}>
              {method}
            </Badge>
            <div className="p-1.5 bg-background rounded-md border">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mb-3">
          <code className="bg-muted/80 px-3 py-1.5 rounded-md text-sm border backdrop-blur-sm">
            {endpoint}
          </code>
        </div>
        
        <h3 className="text-lg">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </CardHeader>
      
      <CardContent className="p-6">
        <CodeBlock code={code} />
      </CardContent>
    </Card>
  );
}