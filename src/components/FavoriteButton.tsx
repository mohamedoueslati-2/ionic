import { IonButton, IonIcon } from '@ionic/react';
import { heart, heartOutline } from 'ionicons/icons';

interface Props {
  title: string;
  favorite: boolean;
  disabled: boolean;
  onClick: () => void;
}

export default function FavoriteButton({ title, favorite, disabled, onClick }: Props) {
  return (
    <IonButton
      className={`movie-favorite-button${favorite ? ' is-favorite' : ''}`}
      shape="round"
      disabled={disabled}
      aria-label={`${favorite ? 'Remove' : 'Add'} ${title} ${favorite ? 'from' : 'to'} Favorites`}
      aria-pressed={favorite ? 'true' : 'false'}
      onClick={onClick}
    >
      <IonIcon slot="icon-only" icon={favorite ? heart : heartOutline} aria-hidden="true" />
    </IonButton>
  );
}
