import { useEffect, useId, useState } from "react";
import { SITE_URL } from "../lib/seoPages";
import "./Profile.css";

// In My contributions: the signed-in user's public profile switch. It's off
// until they turn it on.
function ProfileSettings({ login }) {
  const publicId = useId();
  const indexId = useId();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile?settings=1", { headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data) setSettings({ enabled: data.enabled, indexable: data.indexable });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Without saving, there's nothing to switch, so the section stays hidden.
  if (!settings) return null;

  const save = async (next) => {
    setSaving(true);
    setFailed(false);
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = response.ok ? await response.json() : null;
      if (data) setSettings({ enabled: data.enabled, indexable: data.indexable });
      else setFailed(true);
    } catch {
      setFailed(true);
    }
    setSaving(false);
  };

  const url = `${SITE_URL}/u/${login}`;
  return (
    <section className="profile-settings" aria-label="Public profile">
      <h3>Public profile</h3>
      <p>
        <input
          id={publicId}
          type="checkbox"
          checked={settings.enabled}
          disabled={saving}
          onChange={(event) => save({ enabled: event.target.checked, indexable: false })}
        />{" "}
        <label htmlFor={publicId}>Show my merged pull requests on a public page</label>
      </p>
      {settings.enabled && (
        <>
          <p>
            <input
              id={indexId}
              type="checkbox"
              checked={settings.indexable}
              disabled={saving}
              onChange={(event) => save({ enabled: true, indexable: event.target.checked })}
            />{" "}
            <label htmlFor={indexId}>Let search engines list it</label>
          </p>
          <p>
            <a href={`/u/${login}`}>{url.replace("https://", "")}</a>
          </p>
        </>
      )}
      <p className="profile-settings-note">
        Only public, merged pull requests are shown. You can turn this off at any time.
      </p>
      {failed && (
        <p role="alert" className="profile-settings-note">
          Couldn&rsquo;t save that. Try again in a moment.
        </p>
      )}
    </section>
  );
}

export default ProfileSettings;
