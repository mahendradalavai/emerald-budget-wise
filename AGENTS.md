<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Profile rules (username change cooldown) are enforced by a DB trigger on public.profiles, not only in UI — clients can bypass UI checks.
- Avatars live in a private storage bucket under `<user_id>/`; display via signed URLs — public buckets are blocked on this project.
