
export interface RentalPsOutlet {
    id: string;
    name: string;
    isActive: boolean;
}

export interface RentalRecord {
    id: string;
    invoiceNumber: string;
    customerName: string;
    psType: string;
    duration: number;
    totalAmount: number;
    paymentMethod: string;
    cashAmount: number;
    transferAmount: number;
    createdAt: string;
    outletId: string;
    staffName?: string;
    outlet?: RentalPsOutlet;
}


export interface RentalPsPrice {
    id: string;
    name: string;
    pricePerHour: number;
    isActive: boolean;
    tenantId: string;
    outletId: string;
}

export type PSStage = 'LIST' | 'FORM' | 'SUCCESS' | 'SETTINGS';
