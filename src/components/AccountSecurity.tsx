import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonText,
} from '@ionic/react';
import type { AccountSecurityProps } from '../types/auth';

// L'email reste en lecture seule ; seuls les mots de passe MovieMatch sont modifiables.
export default function AccountSecurity({ busy, email, providerIds, onChangePassword }: AccountSecurityProps) {
  const [editing, setEditing] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [validationError, setValidationError] = useState('');
  const [notice, setNotice] = useState('');
  const hasPassword = providerIds.includes('password');
  const hasGoogle = providerIds.includes('google.com');
  const canSetPassword = hasPassword || hasGoogle;

  // Efface les champs sensibles après une annulation ou une sauvegarde réussie.
  function openForm(next: boolean) {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmation('');
    setValidationError('');
    setNotice('');
    setEditing(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setValidationError('');
    setNotice('');
    if (newPassword !== confirmation) {
      setValidationError('The new passwords do not match.');
      return;
    }
    if (await onChangePassword(currentPassword, newPassword)) {
      const wasPasswordAccount = hasPassword;
      openForm(false);
      setNotice(wasPasswordAccount
        ? 'Password updated successfully.'
        : 'MovieMatch password created. You can now sign in with your email and password, or with Google.');
    }
  }

  return (
    <IonCard className="profile-card">
      <IonCardHeader><IonCardTitle>Account and security</IonCardTitle></IonCardHeader>
      <IonList>
        <IonItem><IonLabel><p>Sign-in email</p><h2 className="profile-email">{email}</h2></IonLabel></IonItem>
      </IonList>
      <IonCardContent>
        <IonText color="medium"><p>Your sign-in email cannot be changed.</p></IonText>
        {canSetPassword && !editing && (
          <IonButton expand="block" fill="outline" disabled={busy} onClick={() => openForm(true)}>
            {hasPassword ? 'Change password' : 'Set MovieMatch password'}
          </IonButton>
        )}
        {/* Un compte Google peut ajouter un mot de passe pour se connecter à MovieMatch. */}
        {hasGoogle && !hasPassword && (
          <IonText color="medium"><p>Create a MovieMatch password for this email. You will confirm your identity with Google when saving.</p></IonText>
        )}
        {canSetPassword && editing && (
          <form onSubmit={(event) => void submit(event)}>
            <IonText><h3>{hasPassword ? 'Change password' : 'Set MovieMatch password'}</h3></IonText>
            <IonList>
              {/* Un compte uniquement Google n'a pas encore de mot de passe MovieMatch actuel. */}
              {hasPassword && (
                <IonItem>
                  <IonInput label="Current password" labelPlacement="stacked" name="currentPassword" type="password" autocomplete="current-password"
                    value={currentPassword} onIonInput={(event) => setCurrentPassword(event.detail.value ?? '')} disabled={busy} required />
                </IonItem>
              )}
              <IonItem>
                <IonInput label="New password" labelPlacement="stacked" name="newPassword" type="password" autocomplete="new-password" minlength={6}
                  value={newPassword} onIonInput={(event) => setNewPassword(event.detail.value ?? '')} disabled={busy} required />
              </IonItem>
              <IonItem>
                <IonInput label="Confirm new password" labelPlacement="stacked" name="confirmPassword" type="password" autocomplete="new-password" minlength={6}
                  value={confirmation} onIonInput={(event) => setConfirmation(event.detail.value ?? '')} disabled={busy} required />
              </IonItem>
            </IonList>
            {validationError && <IonText color="danger"><p role="alert">{validationError}</p></IonText>}
            <IonButton expand="block" type="submit" disabled={busy}>
              {hasPassword ? 'Save password' : 'Confirm with Google and save'}
            </IonButton>
            <IonButton expand="block" type="button" fill="clear" disabled={busy} onClick={() => openForm(false)}>Cancel</IonButton>
          </form>
        )}
        {notice && <IonText color="success"><p role="status">{notice}</p></IonText>}
      </IonCardContent>
    </IonCard>
  );
}
