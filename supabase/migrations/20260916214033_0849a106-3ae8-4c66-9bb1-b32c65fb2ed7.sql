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
  if public.has_role(auth.uid(), 'admin') then
    return new;
  end if;

  if new.pages_count not in (10, 16) then
    raise exception 'عدد الصفحات غير مسموح';
  end if;

  if new.template_id is not null then
    select coalesce(is_custom, false) into v_is_custom
    from public.story_templates where id = new.template_id;
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
before insert or update of price_egp, discount_egp, pages_count, print_copy, template_id
on public.orders
for each row execute function public.validate_order_pricing();

drop policy if exists "Users insert own rewards" on public.reward_accounts;
create policy "Users insert own rewards"
on public.reward_accounts
for insert
to authenticated
with check (
  auth.uid() = user_id
  and balance = 0
  and lifetime_points = 0
);