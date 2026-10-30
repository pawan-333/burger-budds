-- Apply and commit separately before 019; PostgreSQL must commit new enum values.
alter type public.payment_method_type add value if not exists 'cashfree';
