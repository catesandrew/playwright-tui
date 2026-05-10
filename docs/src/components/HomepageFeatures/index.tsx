import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Live Test Monitoring',
    description: (
      <>
        Watch your Playwright tests execute in real time with per-file progress
        bars, worker status panels, and a live activity stream. See exactly
        which tests are running, passing, and failing as it happens.
      </>
    ),
  },
  {
    title: 'Interactive Controls',
    description: (
      <>
        Rerun failed tests, filter by name, toggle watch mode, and expand
        failure details -- all without leaving the terminal. Keyboard-driven
        workflow keeps you in the flow.
      </>
    ),
  },
  {
    title: 'Smart ETA Estimation',
    description: (
      <>
        Persisted timing history with exponential moving averages provides
        accurate ETA predictions that improve with every run. Know exactly
        when your test suite will finish.
      </>
    ),
  },
];

function Feature({title, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
