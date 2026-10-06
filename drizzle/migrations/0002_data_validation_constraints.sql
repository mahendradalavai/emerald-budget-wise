ALTER TABLE public.expenses ADD CONSTRAINT expenses_amount_range CHECK (amount > 0 AND amount <= 100000000) NOT VALID;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_note_len CHECK (note IS NULL OR char_length(note) <= 200) NOT VALID;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_len CHECK (char_length(category) BETWEEN 1 AND 64) NOT VALID;
ALTER TABLE public.budgets ADD CONSTRAINT budgets_amount_range CHECK (amount >= 0 AND amount <= 100000000) NOT VALID;
ALTER TABLE public.budgets ADD CONSTRAINT budgets_month_fmt CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$') NOT VALID;
ALTER TABLE public.categories ADD CONSTRAINT categories_label_len CHECK (char_length(btrim(label)) BETWEEN 1 AND 30) NOT VALID;
ALTER TABLE public.categories ADD CONSTRAINT categories_emoji_len CHECK (char_length(emoji) BETWEEN 1 AND 16) NOT VALID;
CREATE INDEX IF NOT EXISTS expenses_user_spent_on_idx ON public.expenses (user_id, spent_on);