import type { ReactNode } from 'react';
import {
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonPage,
  IonProgressBar,
  IonRow,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react';

interface Props {
  title: string;
  busy?: boolean;
  error?: string;
  children?: ReactNode;
  wide?: boolean;
}

// Structure Ionic commune : chaque écran possède sa page, son en-tête et son contenu.
const PageLayout = ({ title, busy = false, error, children, wide = false }: Props) => (
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>{title}</IonTitle>
      </IonToolbar>
      {/* Indique qu'une opération Firebase est en cours. */}
      {busy && <IonProgressBar type="indeterminate" aria-label="Loading" />}
    </IonHeader>
    <IonContent className="ion-padding">
      {/* La grille Ionic adapte la largeur du formulaire au téléphone et à l'ordinateur. */}
      <IonGrid fixed>
        <IonRow className="ion-justify-content-center">
          <IonCol size="12" sizeMd={wide ? '12' : '8'} sizeLg={wide ? '12' : '6'}>
            {error && <IonText color="danger"><p role="alert">{error}</p></IonText>}
            {children}
          </IonCol>
        </IonRow>
      </IonGrid>
    </IonContent>
  </IonPage>
);

export default PageLayout;
