'use client';

import { Github } from 'lucide-react';

interface GitHubIconProps {
  className?: string;
  size?: number;
}

export function GitHubIcon({ className = "", size = 20 }: GitHubIconProps) {
  return (
    <Github 
      className={className} 
      size={size}
    />
  );
}
