import { MongoClient, ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

const uri = process.env.MONGODB_URI;

export async function GET(_, { params }) {
  try {
    const { id } = params;
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("danceHive");

    const danceClass = await db
      .collection("classes")
      .findOne({ _id: new ObjectId(id) });
    await client.close();

    if (!danceClass) {
      return new Response(JSON.stringify({ error: "Class not found" }), {
        status: 404,
      });
    }

    return new Response(JSON.stringify(danceClass), { status: 200 });
  } catch (error) {
    console.error("GET /api/classes/[id] error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch class" }), {
      status: 500,
    });
  }
}

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
      });
    }

    const { id } = params;
    const updates = await req.json();

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("danceHive");

    const result = await db
      .collection("classes")
      .updateOne({ _id: new ObjectId(id) }, { $set: updates });

    await client.close();

    if (result.modifiedCount === 0) {
      return new Response(JSON.stringify({ message: "No changes made" }), {
        status: 200,
      });
    }

    return new Response(
      JSON.stringify({ message: "Class updated successfully" }),
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("PATCH /api/classes/[id] error:", error);
    return new Response(JSON.stringify({ error: "Failed to update class" }), {
      status: 500,
    });
  }
}

export async function DELETE(_, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
      });
    }

    const { id } = params;
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("danceHive");

    const result = await db
      .collection("classes")
      .deleteOne({ _id: new ObjectId(id) });
    await client.close();

    if (result.deletedCount === 0) {
      return new Response(JSON.stringify({ error: "Class not found" }), {
        status: 404,
      });
    }

    return new Response(
      JSON.stringify({ message: "Class deleted successfully" }),
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/classes/[id] error:", error);
    return new Response(JSON.stringify({ error: "Failed to delete class" }), {
      status: 500,
    });
  }
}
