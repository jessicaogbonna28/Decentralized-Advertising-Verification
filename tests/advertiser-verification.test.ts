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
  },
  maps: {
    advertisers: new Map(),
  },
};

// Mock the contract functions
const advertiserVerification = {
  registerAdvertiser: (name: string, website: string) => {
    const caller = mockClarity.tx.sender;
    const advertiser = mockClarity.maps.advertisers.get(caller);
    
    if (advertiser && advertiser.verified) {
      return { error: 1 };
    }
    
    mockClarity.maps.advertisers.set(caller, {
      name,
      website,
      verified: false,
      'registration-time': mockClarity.block.height,
    });
    
    return { value: true };
  },
  
  verifyAdvertiser: (advertiser: string) => {
    if (mockClarity.tx.sender !== mockClarity.vars['contract-owner']) {
      return { error: 2 };
    }
    
    if (!mockClarity.maps.advertisers.has(advertiser)) {
      return { error: 3 };
    }
    
    const advertiserData = mockClarity.maps.advertisers.get(advertiser);
    mockClarity.maps.advertisers.set(advertiser, {
      ...advertiserData,
      verified: true,
    });
    
    return { value: true };
  },
  
  isVerifiedAdvertiser: (advertiser: string) => {
    const advertiserData = mockClarity.maps.advertisers.get(advertiser);
    return advertiserData ? advertiserData.verified : false;
  },
  
  getAdvertiserDetails: (advertiser: string) => {
    return mockClarity.maps.advertisers.get(advertiser) || null;
  },
};

describe('Advertiser Verification Contract', () => {
  beforeEach(() => {
    // Reset the mock state
    mockClarity.maps.advertisers.clear();
    mockClarity.tx.sender = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    mockClarity.vars['contract-owner'] = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    mockClarity.block.height = 100;
  });
  
  it('should register a new advertiser', () => {
    const result = advertiserVerification.registerAdvertiser('Test Advertiser', 'https://test.com');
    expect(result).toEqual({ value: true });
    
    const advertiserData = mockClarity.maps.advertisers.get(mockClarity.tx.sender);
    expect(advertiserData).toEqual({
      name: 'Test Advertiser',
      website: 'https://test.com',
      verified: false,
      'registration-time': 100,
    });
  });
  
  it('should not allow already verified advertisers to register again', () => {
    // First registration
    advertiserVerification.registerAdvertiser('Test Advertiser', 'https://test.com');
    
    // Verify the advertiser
    advertiserVerification.verifyAdvertiser(mockClarity.tx.sender);
    
    // Try to register again
    const result = advertiserVerification.registerAdvertiser('New Name', 'https://new.com');
    expect(result).toEqual({ error: 1 });
  });
  
  it('should allow contract owner to verify an advertiser', () => {
    // Register an advertiser
    advertiserVerification.registerAdvertiser('Test Advertiser', 'https://test.com');
    
    // Verify the advertiser
    const result = advertiserVerification.verifyAdvertiser(mockClarity.tx.sender);
    expect(result).toEqual({ value: true });
    
    // Check if advertiser is verified
    const isVerified = advertiserVerification.isVerifiedAdvertiser(mockClarity.tx.sender);
    expect(isVerified).toBe(true);
  });
  
  it('should not allow non-owners to verify advertisers', () => {
    // Register an advertiser
    advertiserVerification.registerAdvertiser('Test Advertiser', 'https://test.com');
    
    // Change sender to non-owner
    mockClarity.tx.sender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    
    // Try to verify
    const result = advertiserVerification.verifyAdvertiser('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
    expect(result).toEqual({ error: 2 });
  });
  
  it('should return advertiser details', () => {
    // Register an advertiser
    advertiserVerification.registerAdvertiser('Test Advertiser', 'https://test.com');
    
    // Get details
    const details = advertiserVerification.getAdvertiserDetails(mockClarity.tx.sender);
    expect(details).toEqual({
      name: 'Test Advertiser',
      website: 'https://test.com',
      verified: false,
      'registration-time': 100,
    });
  });
});
