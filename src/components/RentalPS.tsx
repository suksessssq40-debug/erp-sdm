
import React from 'react';
import { User } from '@/types';
import RentalPSPortal from './rental-ps/RentalPSPortal';

interface RentalPSProps {
    currentUser: User;
    toast: any; // Toast is now handled internally in RentalPSPortal or passed from context
}

const RentalPS: React.FC<RentalPSProps> = ({ currentUser }) => {
    return <RentalPSPortal currentUser={currentUser} />;
};

export default RentalPS;
