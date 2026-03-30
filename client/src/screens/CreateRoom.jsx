import ws from "../ws";

export default function CreateRoom() {
  return (
    <>
      <h2>Créer un salon</h2>
      <button
        onClick={() =>
          ws.send(
            JSON.stringify({
              type: "CREATE_ROOM",
              config: {
                language: "python",
                levelCount: 9,
                questionsPerLevel: 3,
                questionType: "mixte",
                timePerLevelSec: 120,
              },
            })
          )
        }
      >
        Accéder au salon
      </button>
    </>
  );
}
