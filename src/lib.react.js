import React from 'https://esm.sh/react@18.3.1';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(React.createElement);

export { React, html };
export const { useEffect, useMemo, useState } = React;
