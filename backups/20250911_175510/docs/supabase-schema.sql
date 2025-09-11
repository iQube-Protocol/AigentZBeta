-- iQube Templates Table Schema
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.iqube_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  iqube_type text CHECK (iqube_type IN ('DataQube', 'ContentQube', 'ToolQube', 'ModelQube', 'AigentQube')),
  instance_type text CHECK (instance_type IN ('template', 'instance')) DEFAULT 'template',
  business_model text CHECK (business_model IN ('Buy', 'Sell', 'Rent', 'Lease', 'Subscribe', 'Stake', 'License', 'Donate')),
  sensitivity_score integer CHECK (sensitivity_score BETWEEN 0 AND 10) DEFAULT 0,
  accuracy_score integer CHECK (accuracy_score BETWEEN 0 AND 10) NOT NULL,
  verifiability_score integer CHECK (verifiability_score BETWEEN 0 AND 10) NOT NULL,
  risk_score integer CHECK (risk_score BETWEEN 0 AND 10) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  owner uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  public_read boolean NOT NULL DEFAULT true
);

-- Enable Row Level Security
ALTER TABLE public.iqube_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public templates are viewable by everyone" ON public.iqube_templates
  FOR SELECT USING (public_read = true);

CREATE POLICY "Users can view their own templates" ON public.iqube_templates
  FOR SELECT USING (auth.uid() = owner);

CREATE POLICY "Users can insert their own templates" ON public.iqube_templates
  FOR INSERT WITH CHECK (auth.uid() = owner);

CREATE POLICY "Users can update their own templates" ON public.iqube_templates
  FOR UPDATE USING (auth.uid() = owner);

CREATE POLICY "Users can delete their own templates" ON public.iqube_templates
  FOR DELETE USING (auth.uid() = owner);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_iqube_templates_updated_at
  BEFORE UPDATE ON public.iqube_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Insert sample data
INSERT INTO public.iqube_templates (name, description, iqube_type, instance_type, business_model, sensitivity_score, accuracy_score, verifiability_score, risk_score, public_read) VALUES
('Personal Data iQube', 'Template for storing and managing personal identity information with high security and privacy controls.', 'DataQube', 'template', 'Subscribe', 7, 9, 7, 8, true),
('Financial Transaction iQube', 'Secure template for recording and verifying financial transactions with audit trails.', 'DataQube', 'template', 'Buy', 6, 10, 9, 6, true),
('Content Verification iQube', 'Template for verifying the authenticity and provenance of digital content and media.', 'ContentQube', 'template', 'License', 3, 8, 10, 4, true),
('Credential iQube', 'Template for storing and verifying professional credentials and certifications.', 'ToolQube', 'template', 'Sell', 5, 9, 8, 5, true),
('Health Data iQube', 'Secure template for managing sensitive health information with privacy controls.', 'DataQube', 'template', 'Donate', 9, 9, 6, 9, true),
('Research Data iQube', 'Template for storing and sharing scientific research data with verification mechanisms.', 'ModelQube', 'template', 'Rent', 3, 8, 9, 3, true);
