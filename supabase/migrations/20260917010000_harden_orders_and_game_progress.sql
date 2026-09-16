-- Critical hardening: commercial order pricing and game progress are server-owned state.

create or replace function public.validate_order_pricing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_custom boolean := false;
  v_base integer;
  v_total integer;
begin
  -- Trusted service-role operations and authenticated admins are allowed to manage pricing.
  if auth.role() = 'service_role' or public.has_role(auth.uid(), 'admin') then
    return new;
  end if;

  -- Customers may update non-commercial fields through explicitly allowed app flows,
  -- but pricing inputs themselves are immutable from the browser.
  if tg_op = 'UPDATE' then
    if new.price_egp is distinct from old.price_egp
      or new.discount_egp is distinct from old.discount_egp
      or new.pages_count is distinct from old.pages_count
      or new.print_copy is distinct from old.print_copy
      or new.template_id is distinct from old.template_id
      or new.is_custom_request is distinct from old.is_custom_request
    then
      raise exception 'حقول التسعير تدار من الخادم فقط';
    end if;
    return new;
  end if;

  -- Defense in depth for any non-service INSERT that may exist outside the API.
  if new.pages_count not in (10, 16) then
    raise exception 'عدد الصفحات غير مسموح';
  end if;

  if new.template_id is not null then
    select coalesce(is_custom, false)
      into v_is_custom
      from public.story_templates
     where id = new.template_id;
  end if;
  v_is_custom := coalesce(v_is_custom, false) or coalesce(new.is_custom_request, false);

  v_base := case
    when v_is_custom and new.pages_count = 10 then 200
    when v_is_custom then 250
    when new.pages_count = 10 then 150
    else 200
  end;

  if new.discount_egp < 0 or new.discount_egp > v_base then
    raise exception 'قيمة الخصم غير صالحة';
  end if;

  v_total := new.price_egp + new.discount_egp;
  if v_total <> v_base and v_total <> v_base + 200 then
    raise exception 'سعر الطلب غير مطابق للتسعير المعتمد';
  end if;

  if v_total = v_base + 200 and coalesce(new.print_copy, false) = false then
    raise exception 'رسوم الطباعة غير مطابقة للطلب';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_order_pricing on public.orders;
create trigger trg_validate_order_pricing
before insert or update of price_egp, discount_egp, pages_count, print_copy, template_id, is_custom_request
on public.orders
for each row execute function public.validate_order_pricing();

-- Orders must be created by authenticated server functions that calculate prices.
revoke insert on table public.orders from anon, authenticated;

-- Game/puzzle progress is now mutated only through authenticated server functions.
-- Browsers retain read access through the existing RLS policies.
revoke insert, update, delete on table public.game_progress from anon, authenticated;
