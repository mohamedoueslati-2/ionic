import { IonInput, IonItem } from '@ionic/react';
import type { PersonalInfo } from '../types/auth';

// Le parent conserve les valeurs et reçoit chaque modification via onChange.
interface Props {
  value: PersonalInfo;
  onChange: (value: PersonalInfo) => void;
  disabled: boolean;
}

// Champs réutilisés par Signup et CompleteProfile pour éviter de les écrire deux fois.
// « ...value » conserve les autres champs lorsqu'un seul champ change.
const PersonalInfoFields = ({ value, onChange, disabled }: Props) => (
  <>
    {/* IonInput fournit le style Ionic et une étiquette accessible pour chaque champ. */}
    <IonItem>
      <IonInput label="First Name" labelPlacement="stacked" name="firstName" autocomplete="given-name"
        value={value.firstName} disabled={disabled} required
        onIonInput={(e) => onChange({ ...value, firstName: e.detail.value ?? '' })} />
    </IonItem>
    <IonItem>
      <IonInput label="Last Name" labelPlacement="stacked" name="lastName" autocomplete="family-name"
        value={value.lastName} disabled={disabled} required
        onIonInput={(e) => onChange({ ...value, lastName: e.detail.value ?? '' })} />
    </IonItem>
    {/* Le navigateur limite l'âge ; le service effectue aussi sa propre validation. */}
    <IonItem>
      <IonInput label="Age" labelPlacement="stacked" name="age" type="number" inputmode="numeric"
        min="1" max="120" step="1" value={value.age} disabled={disabled} required
        onIonInput={(e) => onChange({ ...value, age: e.detail.value ?? '' })} />
    </IonItem>
  </>
);

export default PersonalInfoFields;
