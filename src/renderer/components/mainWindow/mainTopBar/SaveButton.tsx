import * as React from 'react';
import { Button } from '@/components/ui/button';
import { BookmarkIcon } from '@radix-ui/react-icons';

export const SaveButton: React.FC = () => (
  <Button className="gap-3 px-3 ml-2" variant="outline">
    <div><BookmarkIcon /></div>
    <span className="leading-4">Save</span>
  </Button>
);
