import React from 'react';
import { PortalList } from './PortalList';

const PortalsPage: React.FC = () => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <PortalList />
      </div>
    </div>
  );
};

export default PortalsPage;
