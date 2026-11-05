  export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = 'employee' | 'administrator';
export type CustomerStatus = 'active' | 'suspended' | 'closed';
export type CustomerType = 'member' | 'non_member';
export type MeterStatus = 'active' | 'inactive' | 'replaced' | 'damaged';
export type MeterCondition = 'normal' | 'rollover' | 'replaced' | 'unreadable';
export type InvoiceStatus = 'draft' | 'finalized' | 'partially_paid' | 'paid' | 'overdue' | 'void';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'reversed';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'e_wallet' | 'check' | 'other';
export type RoundingMode = 'half_up' | 'half_even' | 'up' | 'down';

type TableDefinition<Row, RequiredInsert extends keyof Row> = {
  Row: Row;
  Insert: Omit<Partial<Row>, RequiredInsert> & Pick<Row, RequiredInsert>;
  Update: Partial<Row>;
  Relationships: [];
};

export type ProfileRow = { id: string; employee_code: string | null; full_name: string; role: UserRole; phone: string | null; is_active: boolean; created_at: string; updated_at: string; archived_at: string | null };
export type CustomerRow = { id: string; account_number: string; full_name: string; service_address: string; phone: string | null; email: string | null; status: CustomerStatus; customer_type: CustomerType; assigned_employee_id: string | null; route_code: string | null; notes: string | null; created_at: string; updated_at: string; archived_at: string | null };
export type MeterRow = { id: string; meter_number: string; serial_number: string | null; qr_code: string | null; manufacturer: string | null; model: string | null; status: MeterStatus; installed_at: string | null; initial_reading: number; created_at: string; updated_at: string; archived_at: string | null };
export type MeterAssignmentRow = { id: string; customer_id: string; meter_id: string; assigned_by: string | null; started_at: string; ended_at: string | null; created_at: string; updated_at: string };
export type MeterReadingRow = { id: string; customer_id: string; meter_id: string; employee_id: string; previous_reading: number; current_reading: number; consumption: number; condition: MeterCondition; billing_period_start: string; billing_period_end: string; read_at: string; photo_path: string | null; latitude: number | null; longitude: number | null; notes: string | null; client_operation_id: string; synced_at: string | null; created_at: string; updated_at: string };
export type TariffRow = { id: string; code: string; name: string; version: number; effective_from: string; effective_to: string | null; fixed_charge: number; currency: string; customer_type: CustomerType; tax_name: string; tax_rate: number; discount_rate: number; subsidy_amount: number; penalty_rate: number; penalty_grace_days: number; due_days: number; minimum_charge: number; apply_previous_balance: boolean; meter_rollover_value: number; rounding_scale: number; rounding_mode: RoundingMode; is_approved: boolean; approved_by: string | null; approved_at: string | null; created_at: string; updated_at: string; archived_at: string | null };
export type TariffTierRow = { id: string; tariff_id: string; minimum_volume: number; maximum_volume: number | null; rate_per_unit: number; sort_order: number; created_at: string; updated_at: string };
export type InvoiceRow = { id: string; invoice_number: string; customer_id: string; meter_reading_id: string; tariff_id: string; billing_period_start: string; billing_period_end: string; issued_at: string; due_date: string; subtotal: number; fixed_charges: number; discounts: number; taxes: number; penalties: number; previous_balance: number; current_amount: number; total_amount: number; status: InvoiceStatus; tariff_snapshot: Json; created_by: string; finalized_at: string | null; client_operation_id: string; created_at: string; updated_at: string; archived_at: string | null };
export type InvoiceItemRow = { id: string; invoice_id: string; item_type: string; description: string; quantity: number; unit_price: number; amount: number; sort_order: number; calculation_snapshot: Json; created_at: string; updated_at: string };
export type PaymentRow = { id: string; invoice_id: string | null; customer_id: string; amount: number; method: PaymentMethod; reference_number: string | null; status: PaymentStatus; paid_at: string; received_by: string; client_operation_id: string; notes: string | null; created_at: string; updated_at: string };
export type PaymentAllocationRow = { id: string; payment_id: string; invoice_id: string; amount: number; created_at: string };
export type PrinterDeviceRow = { id: string; owner_id: string; name: string; bluetooth_address: string; model: string | null; paper_width_mm: number; is_default: boolean; last_connected_at: string | null; created_at: string; updated_at: string };
export type AuditLogRow = { id: number; actor_id: string | null; action: string; entity_type: string; entity_id: string | null; old_values: Json | null; new_values: Json | null; metadata: Json; created_at: string };

export type Database = {
  public: {
    Tables: {
      profiles: TableDefinition<ProfileRow, 'id' | 'full_name'>;
      customers: TableDefinition<CustomerRow, 'account_number' | 'full_name' | 'service_address'>;
      meters: TableDefinition<MeterRow, 'meter_number'>;
      meter_assignments: TableDefinition<MeterAssignmentRow, 'customer_id' | 'meter_id'>;
      meter_readings: TableDefinition<MeterReadingRow, 'customer_id' | 'meter_id' | 'employee_id' | 'previous_reading' | 'current_reading' | 'consumption' | 'billing_period_start' | 'billing_period_end'>;
      tariffs: TableDefinition<TariffRow, 'code' | 'name' | 'version' | 'effective_from'>;
      tariff_tiers: TableDefinition<TariffTierRow, 'tariff_id' | 'minimum_volume' | 'rate_per_unit' | 'sort_order'>;
      invoices: TableDefinition<InvoiceRow, 'invoice_number' | 'customer_id' | 'meter_reading_id' | 'tariff_id' | 'billing_period_start' | 'billing_period_end' | 'due_date' | 'subtotal' | 'total_amount' | 'tariff_snapshot' | 'created_by'>;
      invoice_items: TableDefinition<InvoiceItemRow, 'invoice_id' | 'item_type' | 'description' | 'amount'>;
      payments: TableDefinition<PaymentRow, 'customer_id' | 'amount' | 'method' | 'received_by'>;
      payment_allocations: TableDefinition<PaymentAllocationRow, 'payment_id' | 'invoice_id' | 'amount'>;
      printer_devices: TableDefinition<PrinterDeviceRow, 'owner_id' | 'name' | 'bluetooth_address'>;
      audit_logs: TableDefinition<AuditLogRow, 'action' | 'entity_type'>;
    };
    Views: Record<string, never>;
    Functions: {
      handle_new_user: { Args: Record<PropertyKey, never>; Returns: unknown };
      set_updated_at: { Args: Record<PropertyKey, never>; Returns: unknown };
      replace_customer_meter: { Args: { target_customer_id: string; new_meter_number: string; new_serial_number?: string | null; new_manufacturer?: string | null; new_model?: string | null; replacement_date?: string; new_initial_reading?: number }; Returns: string };
      create_invoice_atomic: { Args: { p_customer_id: string; p_meter_reading_id: string; p_tariff_id: string; p_billing_period_start: string; p_billing_period_end: string; p_due_date: string; p_subtotal: number; p_fixed_charges: number; p_discounts: number; p_taxes: number; p_penalties: number; p_previous_balance: number; p_total_amount: number; p_tariff_snapshot: Json; p_client_operation_id: string; p_items: Json }; Returns: InvoiceRow };
      begin_invoice_print: { Args: { p_invoice_id: string; p_is_reprint?: boolean; p_reason?: string | null; p_metadata?: Json }; Returns: number };
      complete_invoice_print: { Args: { p_invoice_id: string; p_attempt_id: number; p_succeeded: boolean; p_error?: string | null }; Returns: undefined };
      record_admin_audit: { Args: { p_action: string; p_entity_type: string; p_entity_id?: string | null; p_metadata?: Json }; Returns: number };
      get_customer_arrears: { Args: { p_customer_id: string; p_before_date?: string | null }; Returns: { previous_arrears: number; oldest_due_date: string | null; open_invoice_count: number }[] };
      record_customer_payment: { Args: { p_customer_id: string; p_amount: number; p_method: PaymentMethod; p_reference_number?: string | null; p_notes?: string | null; p_client_operation_id?: string }; Returns: PaymentRow };
    };
    Enums: {
      user_role: UserRole;
      customer_status: CustomerStatus;
      customer_type: CustomerType;
      meter_status: MeterStatus;
      meter_condition: MeterCondition;
      invoice_status: InvoiceStatus;
      payment_status: PaymentStatus;
      payment_method: PaymentMethod;
      rounding_mode: RoundingMode;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<TableName extends keyof Database['public']['Tables']> = Database['public']['Tables'][TableName]['Row'];
export type TablesInsert<TableName extends keyof Database['public']['Tables']> = Database['public']['Tables'][TableName]['Insert'];
export type TablesUpdate<TableName extends keyof Database['public']['Tables']> = Database['public']['Tables'][TableName]['Update'];
