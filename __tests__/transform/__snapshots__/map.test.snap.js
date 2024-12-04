/* @web/test-runner snapshot v1 */
export const snapshots = {};

snapshots["transform map correctly transforms tokenMap and defers tokens transforms as needed"] = 
`[
  [
    "{colors.red.500}",
    {
      "value": "#ff0000",
      "name": "{colors.red.500}",
      "attributes": {}
    }
  ],
  [
    "{colors.foreground.primary}",
    {
      "value": "#ff0000",
      "name": "transform result",
      "attributes": {}
    }
  ],
  [
    "{spacing.0}",
    {
      "value": "0px",
      "name": "{spacing.0}",
      "attributes": {
        "foo": "bar"
      }
    }
  ],
  [
    "{spacing.1}",
    {
      "value": "4px",
      "name": "{spacing.1}",
      "attributes": {
        "bar": "foo"
      }
    }
  ],
  [
    "{spacing.2}",
    {
      "value": "8px",
      "name": "{spacing.2}",
      "attributes": {}
    }
  ],
  [
    "{spacing.0p5}",
    {
      "value": "2px",
      "name": "{spacing.0p5}",
      "attributes": {}
    }
  ],
  [
    "{spacing.0p5-ref}",
    {
      "value": 2,
      "name": "{spacing.0p5-ref}",
      "attributes": {}
    }
  ],
  [
    "{border}",
    {
      "value": {
        "width": 2,
        "color": "#ff0000",
        "width_plus_one": 3
      },
      "name": "{border}",
      "attributes": {}
    }
  ]
]`;
/* end snapshot transform map correctly transforms tokenMap and defers tokens transforms as needed */

