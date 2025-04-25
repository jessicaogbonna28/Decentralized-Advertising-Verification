import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity VM environment
const mockClarity = {
  tx: {
    sender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  },
  block: {
    height: 100,
  },
  contracts: {
    call: vi.fn(),
  },
  vars: {
    'contract-owner': 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    'payment-rate': 1000000,
  },
  maps: {
    'processed-payments': new Map(),
  },
  stxTransfer: vi.fn().mockReturnValue({ value: true }),
};

// Mock the campaign registration contract
const mockCampaignRegistration = {
  getCampaignDetails: vi.fn().mockReturnValue({
    advertiser: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
    name: 'Test Campaign',
    budget: 10000000,
    'start-block': 50,
    'end-block': 150,
    active: true,
  }),
};

// Mock the impression tracking contract
const mockImpressionTracking = {
  getCampaignImpressionCount: vi.fn().mockReturnValue(5),
};

// Mock the contract functions
const paymentSettlement = {
  setPaymentRate: (newRate: number) => {
    if (mockClarity.tx.sender !== mockClarity.vars['contract-owner']) {
      return { error: 1 };
    }
    
    mockClarity.vars['payment-rate'] = newRate;
    return { value: true };
  },
  
  processPayment: (campaignId: number, publisher: string) => {
    // Get campaign details
    const campaign = mockCampaignRegistration.getCampaignDetails(campaignId);
    if (!campaign) {
      return { error: 2 };
    }
    
    const advertiser = campaign.advertiser;
    const paymentKey = JSON.stringify({
      'campaign-id': campaignId,
      'publisher': publisher,
    });
    
    const processedCount = mockClarity.maps['processed-payments'].get(paymentKey) || 0;
    const currentCount = mockImpressionTracking.getCampaignImpressionCount(campaignId);
    const newImpressions = currentCount - processedCount;
    
    if (newImpressions <= 0) {
      return { error: 3 };
    }
    
    const paymentAmount = newImpressions * mockClarity.vars['payment-rate'];
    
    // Transfer payment
    const transferResult = mockClarity.stxTransfer(paymentAmount, advertiser, publisher);
    if (transferResult.error) {
      return transferResult;
    }
    
    // Update processed payments
    mockClarity.maps['processed-payments'].set(paymentKey, currentCount);
    
    return { value: true };
  },
  
  claimPayment: (campaignId: number) => {
    const publisher = mockClarity.tx.sender;
    return paymentSettlement.processPayment(campaignId, publisher);
  },
  
  getPaymentRate: () => {
    return mockClarity.vars['payment-rate'];
  },
  
  calculatePendingPayment: (campaignId: number, publisher: string) => {
    const paymentKey = JSON.stringify({
      'campaign-id': campaignId,
      'publisher': publisher,
    });
    
    const processedCount = mockClarity.maps['processed-payments'].get(paymentKey) || 0;
    const currentCount = mockImpressionTracking.getCampaignImpressionCount(campaignId);
    const newImpressions = currentCount - processedCount;
    const paymentAmount = newImpressions * mockClarity.vars['payment-rate'];
    
    return paymentAmount;
  },
};

describe('Payment Settlement Contract', () => {
  beforeEach(() => {
    // Reset the mock state
    mockClarity.maps['processed-payments'].clear();
    mockClarity.tx.sender = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    mockClarity.vars['contract-owner'] = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    mockClarity.vars['payment-rate'] = 1000000;
    mockClarity.block.height = 100;
    
    // Reset mocks
    mockCampaignRegistration.getCampaignDetails.mockClear();
    mockCampaignRegistration.getCampaignDetails.mockReturnValue({
      advertiser: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
      name: 'Test Campaign',
      budget: 10000000,
      'start-block': 50,
      'end-block': 150,
      active: true,
    });
    
    mockImpressionTracking.getCampaignImpressionCount.mockClear();
    mockImpressionTracking.getCampaignImpressionCount.mockReturnValue(5);
    
    mockClarity.stxTransfer.mockClear();
    mockClarity.stxTransfer.mockReturnValue({ value: true });
  });
  
  it('should allow admin to set payment rate', () => {
    const result = paymentSettlement.setPaymentRate(2000000);
    expect(result).toEqual({ value: true });
    expect(mockClarity.vars['payment-rate']).toBe(2000000);
  });
  
  it('should not allow non-admin to set payment rate', () => {
    mockClarity.tx.sender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    
    const result = paymentSettlement.setPaymentRate(2000000);
    expect(result).toEqual({ error: 1 });
    expect(mockClarity.vars['payment-rate']).toBe(1000000); // Unchanged
  });
  
  it('should process payment for new impressions', () => {
    const result = paymentSettlement.processPayment(1, 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
    expect(result).toEqual({ value: true });
    
    // Check if STX transfer was called with correct parameters
    expect(mockClarity.stxTransfer).toHaveBeenCalledWith(
        5000000, // 5 impressions * 1000000 rate
        'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG', // advertiser
        'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM' // publisher
    );
    
    // Check if processed payments was updated
    const paymentKey = JSON.stringify({
      'campaign-id': 1,
      'publisher': 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    });
    expect(mockClarity.maps['processed-payments'].get(paymentKey)).toBe(5);
  });
  
  it('should not process payment if no new impressions', () => {
    // Set already processed count
    const paymentKey = JSON.stringify({
      'campaign-id': 1,
      'publisher': 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    });
    mockClarity.maps['processed-payments'].set(paymentKey, 5);
    
    const result = paymentSettlement.processPayment(1, 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
    expect(result).toEqual({ error: 3 });
    
    // Check that STX transfer was not called
    expect(mockClarity.stxTransfer).not.toHaveBeenCalled();
  });
  
  it('should allow publisher to claim payment', () => {
    mockClarity.tx.sender = 'ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    
    const result = paymentSettlement.claimPayment(1);
    expect(result).toEqual({ value: true });
    
    // Check if STX transfer was called with correct parameters
    expect(mockClarity.stxTransfer).toHaveBeenCalledWith(
        5000000, // 5 impressions * 1000000 rate
        'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG', // advertiser
        'ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM' // publisher (tx.sender)
    );
  });
  
  it('should calculate pending payment correctly', () => {
    // Set already processed count
    const paymentKey = JSON.stringify({
      'campaign-id': 1,
      'publisher': 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    });
    mockClarity.maps['processed-payments'].set(paymentKey, 2);
    
    const pendingPayment = paymentSettlement.calculatePendingPayment(1, 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
    expect(pendingPayment).toBe(3000000); // (5-2) impressions * 1000000 rate
  });
  
  it('should return current payment rate', () => {
    const rate = paymentSettlement.getPaymentRate();
    expect(rate).toBe(1000000);
  });
});
