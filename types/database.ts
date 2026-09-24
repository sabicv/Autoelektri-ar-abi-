// =====================================================================
// Auto Električar SaaS — TypeScript definitions mapped to supabase/schema.sql
// =====================================================================

// ---------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------
export type JobStatus =
  | 'PENDING_TRIAGE'
  | 'IN_DIAGNOSTIC'
  | 'PARASITIC_DRAIN_TESTING'
  | 'AWAITING_MODULE_REMAP'
  | 'IN_REPAIR'
  | 'FINISHED_AWAITING_PICKUP'
  | 'COLLECTED';

export const JOB_STATUSES: readonly JobStatus[] = [
  'PENDING_TRIAGE',
  'IN_DIAGNOSTIC',
  'PARASITIC_DRAIN_TESTING',
  'AWAITING_MODULE_REMAP',
  'IN_REPAIR',
  'FINISHED_AWAITING_PICKUP',
  'COLLECTED',
];

export type PhotoTag =
  | 'INTAKE_CONDITION'
  | 'REGISTRATION_CARD'
  | 'DTC_DIAGNOSTIC_SCREEN'
  | 'WIRING_DEFECT'
  | 'NEW_PARTS'
  | 'PARTS_INVOICE';

export const PHOTO_TAGS: readonly PhotoTag[] = [
  'INTAKE_CONDITION',
  'REGISTRATION_CARD',
  'DTC_DIAGNOSTIC_SCREEN',
  'WIRING_DEFECT',
  'NEW_PARTS',
  'PARTS_INVOICE',
];

// ---------------------------------------------------------------------
// Supabase-generated-style Database interface
// (Row = select shape, Insert = required/optional for insert,
//  Update = every column optional)
// ---------------------------------------------------------------------
export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          phone: string | null;
          address: string | null;
          industry_type: string;
          free_parking_days: number;
          daily_parking_fee: number;
          emergency_surcharge_percent: number;
          vapi_phone_number_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          phone?: string | null;
          address?: string | null;
          industry_type?: string;
          free_parking_days?: number;
          daily_parking_fee?: number;
          emergency_surcharge_percent?: number;
          vapi_phone_number_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>;
        Relationships: [];
      };

      profiles: {
        Row: {
          id: string;
          tenant_id: string;
          full_name: string | null;
          role: string;
          created_at: string;
        };
        Insert: {
          id: string;
          tenant_id: string;
          full_name?: string | null;
          role?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'profiles_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };

      clients: {
        Row: {
          id: string;
          tenant_id: string;
          first_name: string;
          last_name: string;
          phone_number: string;
          email: string | null;
          notes: string | null;
          address: string | null;
          oib: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          first_name: string;
          last_name: string;
          phone_number: string;
          email?: string | null;
          notes?: string | null;
          address?: string | null;
          oib?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['clients']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'clients_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };

      vehicles: {
        Row: {
          id: string;
          tenant_id: string;
          client_id: string;
          vin: string | null;
          registration_plate: string | null;
          make: string | null;
          model: string | null;
          year: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          client_id: string;
          vin?: string | null;
          registration_plate?: string | null;
          make?: string | null;
          model?: string | null;
          year?: number | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['vehicles']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'vehicles_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicles_client_id_fkey';
            columns: ['client_id'];
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
        ];
      };

      jobs: {
        Row: {
          id: string;
          tenant_id: string;
          client_id: string;
          vehicle_id: string;
          status: JobStatus;
          is_emergency: boolean;
          emergency_surcharge_percent: number;
          diagnostic_hours: number;
          repair_hours: number;
          symptoms: string[];
          diagnostic_notes: string | null;
          work_summary: string | null;
          total_parts_cost: number;
          total_labor_cost: number;
          accrued_parking_fees: number;
          finished_at: string | null;
          collected_at: string | null;
          confirmed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          client_id: string;
          vehicle_id: string;
          status?: JobStatus;
          is_emergency?: boolean;
          emergency_surcharge_percent?: number;
          diagnostic_hours?: number;
          repair_hours?: number;
          symptoms?: string[];
          diagnostic_notes?: string | null;
          work_summary?: string | null;
          total_parts_cost?: number;
          total_labor_cost?: number;
          accrued_parking_fees?: number;
          finished_at?: string | null;
          collected_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['jobs']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'jobs_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'jobs_client_id_fkey';
            columns: ['client_id'];
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'jobs_vehicle_id_fkey';
            columns: ['vehicle_id'];
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };

      diagnostic_reports: {
        Row: {
          id: string;
          job_id: string;
          dtc_codes: string[];
          battery_drain_ma: number | null;
          module_notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          dtc_codes?: string[];
          battery_drain_ma?: number | null;
          module_notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['diagnostic_reports']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'diagnostic_reports_job_id_fkey';
            columns: ['job_id'];
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
        ];
      };

      job_photos: {
        Row: {
          id: string;
          job_id: string;
          tenant_id: string;
          photo_url: string;
          tag: PhotoTag;
          caption: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          tenant_id: string;
          photo_url: string;
          tag: PhotoTag;
          caption?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['job_photos']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'job_photos_job_id_fkey';
            columns: ['job_id'];
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'job_photos_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };

      job_events: {
        Row: {
          id: string;
          tenant_id: string;
          job_id: string;
          event_type: string;
          actor: 'system' | 'mechanic' | 'client';
          message: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          job_id: string;
          event_type: string;
          actor?: 'system' | 'mechanic' | 'client';
          message?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['job_events']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'job_events_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'job_events_job_id_fkey';
            columns: ['job_id'];
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      auth_tenant_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      submit_triage_intake: {
        Args: {
          p_tenant_slug: string;
          p_first_name: string;
          p_last_name: string;
          p_phone_number: string;
          p_registration_plate: string;
          p_make: string | null;
          p_model: string | null;
          p_year: number | null;
          p_vin: string | null;
          p_symptoms: string[];
          p_description: string | null;
          p_is_emergency: boolean;
          p_address?: string | null;
          p_oib?: string | null;
        };
        Returns: { job_id: string; tenant_id: string; job_reference: string }[];
      };
      apply_upsell_response: {
        Args: {
          p_job_id: string;
          p_approved: boolean;
        };
        Returns: { applied: boolean; price: number | null; tenant_id: string }[];
      };
      recalculate_parking_fees: {
        Args: Record<string, never>;
        Returns: { job_id: string; tenant_id: string; days_parked: number; accrued_fee: number }[];
      };
    };
    Enums: {
      job_status: JobStatus;
      photo_tag: PhotoTag;
    };
    CompositeTypes: Record<string, never>;
  };
}

// ---------------------------------------------------------------------
// Convenience row/insert/update aliases
// ---------------------------------------------------------------------
export type Tenant = Database['public']['Tables']['tenants']['Row'];
export type TenantInsert = Database['public']['Tables']['tenants']['Insert'];
export type TenantUpdate = Database['public']['Tables']['tenants']['Update'];

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type Client = Database['public']['Tables']['clients']['Row'];
export type ClientInsert = Database['public']['Tables']['clients']['Insert'];
export type ClientUpdate = Database['public']['Tables']['clients']['Update'];

export type Vehicle = Database['public']['Tables']['vehicles']['Row'];
export type VehicleInsert = Database['public']['Tables']['vehicles']['Insert'];
export type VehicleUpdate = Database['public']['Tables']['vehicles']['Update'];

export type Job = Database['public']['Tables']['jobs']['Row'];
export type JobInsert = Database['public']['Tables']['jobs']['Insert'];
export type JobUpdate = Database['public']['Tables']['jobs']['Update'];

export type DiagnosticReport = Database['public']['Tables']['diagnostic_reports']['Row'];
export type DiagnosticReportInsert = Database['public']['Tables']['diagnostic_reports']['Insert'];
export type DiagnosticReportUpdate = Database['public']['Tables']['diagnostic_reports']['Update'];

export type JobPhoto = Database['public']['Tables']['job_photos']['Row'];
export type JobPhotoInsert = Database['public']['Tables']['job_photos']['Insert'];
export type JobPhotoUpdate = Database['public']['Tables']['job_photos']['Update'];

export type JobEvent = Database['public']['Tables']['job_events']['Row'];
export type JobEventInsert = Database['public']['Tables']['job_events']['Insert'];
export type JobEventUpdate = Database['public']['Tables']['job_events']['Update'];

// ---------------------------------------------------------------------
// Joined relation types (for API responses / server component fetches)
// ---------------------------------------------------------------------
export interface VehicleWithClient extends Vehicle {
  client: Client;
}

export interface ClientWithVehicles extends Client {
  vehicles: Vehicle[];
}

export interface JobWithRelations extends Job {
  client: Client;
  vehicle: Vehicle;
  diagnostic_reports: DiagnosticReport[];
  job_photos: JobPhoto[];
}

export interface JobListItem extends Job {
  client: Pick<Client, 'id' | 'first_name' | 'last_name' | 'phone_number'>;
  vehicle: Pick<Vehicle, 'id' | 'make' | 'model' | 'registration_plate'>;
}

export interface TenantWithStaff extends Tenant {
  profiles: Profile[];
}
