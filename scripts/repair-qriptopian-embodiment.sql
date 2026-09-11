-- Run ONLY after the Papers projection code is deployed and validated.
-- Exact prior-upload receipt CIDs; no re-upload, renumbering, or content edits.
-- Save the preimage result below with the deployment receipt before committing.
begin;
create temporary table embodiment_repair_targets (
 id uuid primary key, cid text not null, previous_url text not null
) on commit drop;
insert into embodiment_repair_targets values
('9370e7ce-28e0-4257-ba3f-4919e6293ffb', 'bafkr6ifvqwhkbfd2ip5ekveuujfrgfu4p723feufyu72hzuc4vaxem52ky', 'https://dev-beta.aigentz.me/api/qriptopian/essay-cover/9370e7ce-28e0-4257-ba3f-4919e6293ffb?name=/papers-polity_20260831010101.png'),
('66d98179-9040-40aa-89aa-45328c2b58c7', 'bafkr6ihy3j7d2fc7xiromb2qretjev43wnvxerv2e7aiagchslidomodmy', 'https://dev-beta.aigentz.me/api/qriptopian/essay-cover/66d98179-9040-40aa-89aa-45328c2b58c7?name=/papers-polity_20260831010202.png'),
('dbd21d56-1e34-405c-adef-7f88df9baa21', 'bafkr6igyunmrjvehc4dai6eteindl55tlixluz6wcgq3qwt4edit4lmhja', 'https://dev-beta.aigentz.me/api/qriptopian/essay-cover/dbd21d56-1e34-405c-adef-7f88df9baa21?name=/papers-polity_20260831010303.png'),
('552b4ad1-09d6-411d-9712-21af61350c57', 'bafkr6ia7xhw3g4x4eiyqg3vbg2pkgpvwvwtb7hzeg75vfntusxn4dd5n3y', 'https://dev-beta.aigentz.me/api/qriptopian/essay-cover/552b4ad1-09d6-411d-9712-21af61350c57?name=/papers-polity_20260831010404.png'),
('5f6120da-a92e-4fee-b3ca-2180048d1e28', 'bafkr6id4qxbm3glamnreepzj65avdrdwk7jt47m2mp4qjf34oklzvmgrre', 'https://dev-beta.aigentz.me/api/qriptopian/essay-cover/5f6120da-a92e-4fee-b3ca-2180048d1e28?name=/papers-polity_20260831010505.png'),
('52370b24-467e-4ee4-8f02-64b09fd00b04', 'bafkr6iargywjrjia4kf3wsglmpzkij5ghsdk7voj2dc5j74qmdxodtntla', 'https://dev-beta.aigentz.me/api/content/media/52370b24-467e-4ee4-8f02-64b09fd00b04?name=/papers-polity_20260831010101.pdf'),
('2e964bcf-13ea-4300-9fd9-7923cee80355', 'bafkr6ihhxjedvtagtzmoabkucoshykl6scsesmk7jmkmdnc5pmbk643kjm', 'https://dev-beta.aigentz.me/api/content/media/2e964bcf-13ea-4300-9fd9-7923cee80355?name=/papers-polity_20260831010202.pdf'),
('94738475-7072-4b7c-951c-bdfeb6e3e6aa', 'bafkr6igvgg5lmvn52ibseorw42dvmbi42pzwgoyhijiidrdoqavtlelcce', 'https://dev-beta.aigentz.me/api/content/media/94738475-7072-4b7c-951c-bdfeb6e3e6aa?name=/papers-polity_20260831010303.pdf'),
('ccd624cb-50c1-41bb-a486-18757ea82445', 'bafkr6icabarw2vuoiskcfgkhvailxaervtheaw4mxfewszcq65hp6zqg7e', 'https://dev-beta.aigentz.me/api/content/media/ccd624cb-50c1-41bb-a486-18757ea82445?name=/papers-polity_20260831010404.pdf'),
('e5d48b5b-3af3-4078-b235-4831cd7c2ed3', 'bafkr6igmmd4i3mzm2p53mtvjdtsfrwci3w5fbhol24mhwgw22bwmqfl3hm', 'https://dev-beta.aigentz.me/api/content/media/e5d48b5b-3af3-4078-b235-4831cd7c2ed3?name=/papers-polity_20260831010505.pdf');
select a.id, a.title, a.series_scope, a.auto_drive_cid, a.created_at
from codex_media_assets a join embodiment_repair_targets t using (id)
for update of a;
do $$
begin
 if (select count(*) from codex_media_assets a
     join embodiment_repair_targets t using(id)
     where a.series='qriptopian' and a.status='active' and a.is_shareable=true
       and ((a.series_scope='papers/polity' and a.auto_drive_cid=t.previous_url)
         or (a.series_scope='papers/embodiment' and a.auto_drive_cid=t.cid))) <> 10 then
   raise exception 'Embodiment repair precondition failed: missing or concurrently changed target';
 end if;
end $$;
update codex_media_assets a
set series_scope='papers/embodiment', auto_drive_cid=t.cid
from embodiment_repair_targets t
where a.id=t.id and (a.series_scope is distinct from 'papers/embodiment' or a.auto_drive_cid is distinct from t.cid);
select a.id, a.title, a.series_scope, a.auto_drive_cid, a.created_at
from codex_media_assets a join embodiment_repair_targets t using (id);
commit;

